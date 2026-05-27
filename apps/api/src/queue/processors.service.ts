import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import { Q_INBOUND, Q_OUTBOUND, Q_CAMPAIGN } from './queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiAgentService } from '../ai/ai-agent.service';
import { SarvamClient } from '../ai/sarvam.client';
import { ModuleRef } from '@nestjs/core';
import type { Queue } from 'bullmq';

@Injectable()
export class Processors implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Workers');
  private workers: Worker[] = [];

  constructor(
    @Inject('REDIS_CONNECTION') private readonly redis: IORedis,
    @Inject(Q_OUTBOUND) private readonly outQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly wa: WhatsappService,
    private readonly realtime: RealtimeGateway,
    private readonly ai: AiAgentService,
    private readonly sarvam: SarvamClient,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap() {
    let flowExec: { runForTrigger: Function } | null = null;
    try {
      const { FlowExecutor } = await import('../flow/flow.executor');
      flowExec = this.moduleRef.get(FlowExecutor, { strict: false });
    } catch {
      /* flow module not loaded */
    }

    this.workers.push(
      new Worker(
        Q_INBOUND,
        async (job) => {
          const { messageId, conversationId } = job.data as {
            messageId: string;
            conversationId: string;
          };
          const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
          if (!msg) return;
          const conv = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
          });
          if (!conv) return;

          if (
            (msg.type === 'VOICE_NOTE' || msg.type === 'AUDIO') &&
            msg.mediaUrl &&
            this.sarvam.isConfigured()
          ) {
            try {
              const buf = await downloadBuffer(msg.mediaUrl);
              const r = await this.sarvam.transcribe(buf, 'audio/ogg');
              await this.prisma.message.update({
                where: { id: msg.id },
                data: { transcription: r.transcript || null },
              });
            } catch (e) {
              this.logger.warn(`Sarvam transcription failed: ${(e as Error).message}`);
            }
          }

          await this.prisma.activity
            .create({
              data: { contactId: conv.contactId, type: 'MESSAGE_RECEIVED', metadata: { messageId } },
            })
            .catch(() => undefined);

          const text = msg.transcription ?? msg.content ?? '';
          if (flowExec) {
            await flowExec.runForTrigger({
              clientId: conv.clientId,
              trigger: 'INBOUND_MESSAGE',
              contactId: conv.contactId,
              conversationId,
              message: text,
            });
            await flowExec.runForTrigger({
              clientId: conv.clientId,
              trigger: 'KEYWORD',
              contactId: conv.contactId,
              conversationId,
              message: text,
            });
          }

          const r = await this.ai.respond({ conversationId });
          if (r.reply) {
            const aiMsg = await this.prisma.message.create({
              data: {
                conversationId,
                direction: 'OUTBOUND',
                type: 'TEXT',
                content: r.reply,
                sentByAI: true,
              },
            });
            await this.prisma.conversation.update({
              where: { id: conversationId },
              data: { lastMessageAt: aiMsg.createdAt },
            });
            this.realtime.emitMessageCreated({
              clientId: conv.clientId,
              conversationId,
              message: aiMsg,
            });
            await this.outQueue.add('send', { messageId: aiMsg.id }, { jobId: `out:${aiMsg.id}` });
          }
        },
        { connection: this.redis },
      ),
    );

    this.workers.push(
      new Worker(
        Q_OUTBOUND,
        async (job) => {
          const { messageId, isTemplate, templateName, templateLang, variables } = job.data as {
            messageId: string;
            isTemplate?: boolean;
            templateName?: string;
            templateLang?: string;
            variables?: string[];
          };
          const msg = await this.prisma.message.findUnique({
            where: { id: messageId },
            include: {
              conversation: {
                include: {
                  whatsappAccount: true,
                  contact: true,
                  client: { select: { agencyId: true } },
                },
              },
            },
          });
          if (!msg) return;
          if (!msg.content && !isTemplate) throw new Error('Message has no content');

          // Plan-limit check — NOT swallowed. If quota exceeded, the job fails
          // and BullMQ retries it (which will keep failing until quota resets).
          // This is intentional: the message stays in the queue rather than being
          // silently dropped, so the operator can see it in the failed-jobs list.
          const { PlanLimitsService } = await import('../billing/plan-limits.service');
          const limits = this.moduleRef.get(PlanLimitsService, { strict: false });
          await limits.assertCanSendMessage(msg.conversation.client.agencyId);

          // Provider dispatch + guardrails
          const result = await this.wa.sendOutbound(msg.conversation.whatsappAccount, {
            to: msg.conversation.contact.phone,
            text: msg.content ?? '',
            isTemplate,
            templateName,
            templateLang,
            variables,
          });

          const updated = await this.prisma.message.update({
            where: { id: msg.id },
            data: { waMessageId: result.waMessageId },
          });
          await this.prisma.activity
            .create({
              data: {
                contactId: msg.conversation.contactId,
                type: 'MESSAGE_SENT',
                metadata: { messageId: msg.id, sentByAI: msg.sentByAI, isCold: result.isCold },
              },
            })
            .catch(() => undefined);
          this.realtime.emitMessageCreated({
            clientId: msg.conversation.clientId,
            conversationId: msg.conversationId,
            message: updated,
          });
        },
        { connection: this.redis },
      ),
    );

    this.workers.push(
      new Worker(
        Q_CAMPAIGN,
        async (job) => {
          const { campaignId, contactId } = job.data as { campaignId: string; contactId: string };
          const camp = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
          if (!camp || camp.status !== 'SENDING') return;
          const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
          if (!contact || contact.optedOut || contact.isBlocked) return;
          const acct = await this.prisma.whatsappAccount.findFirst({
            where: { clientId: camp.clientId, isConnected: true },
          });
          if (!acct) return;

          const rendered = renderTemplate(camp.template ?? '', contact);
          let waId: string | null = null;
          try {
            const r = await this.wa.sendOutbound(acct, {
              to: contact.phone,
              text: rendered,
              // Campaigns to cold contacts MUST be templates on Cloud API.
              isTemplate: acct.provider === 'META_CLOUD',
              templateName: camp.template ?? undefined,
              templateLang: 'en',
            });
            waId = r.waMessageId;
            await this.prisma.campaign.update({
              where: { id: campaignId },
              data: { delivered: { increment: 1 } },
            });
          } catch (e) {
            this.logger.warn(`campaign send blocked: ${(e as Error).message}`);
            return;
          }

          let conv = await this.prisma.conversation.findFirst({
            where: { clientId: camp.clientId, contactId, whatsappAccountId: acct.id },
            orderBy: { createdAt: 'desc' },
          });
          if (!conv) {
            conv = await this.prisma.conversation.create({
              data: {
                clientId: camp.clientId,
                contactId,
                whatsappAccountId: acct.id,
                isAIEnabled: false,
              },
            });
          }
          await this.prisma.message.create({
            data: {
              conversationId: conv.id,
              direction: 'OUTBOUND',
              type: 'TEXT',
              content: rendered,
              waMessageId: waId,
            },
          });
        },
        { connection: this.redis, concurrency: 3 },
      ),
    );

    this.workers.forEach((w) => {
      w.on('failed', (job, err) => this.logger.warn(`job ${job?.id} failed: ${err.message}`));
    });

    this.logger.log('BullMQ workers started');
  }

  async onApplicationShutdown() {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}

function renderTemplate(s: string, contact: { name: string | null; phone: string }): string {
  return s
    .replace(/\{\{\s*name\s*\}\}/gi, contact.name ?? 'there')
    .replace(/\{\{\s*phone\s*\}\}/gi, contact.phone);
}

async function downloadBuffer(url: string): Promise<Buffer> {
  // Block SSRF: only allow http/https to public IPs.
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid media URL'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Media URL must be http or https');
  }
  const h = parsed.hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
      h === '169.254.169.254' || h === 'metadata.google.internal') {
    throw new Error('Media URL points to a blocked host');
  }
  const r = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    maxContentLength: 25 * 1024 * 1024, // 25 MB max
  });
  return Buffer.from(r.data);
}
