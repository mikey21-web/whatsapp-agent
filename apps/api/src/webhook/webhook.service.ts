import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { WhatsappProvider } from '@diyaa/db';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Q_INBOUND } from '../queue/queue.module';
import type { ParsedWebhookEvents, InboundMessage } from '../whatsapp/provider.types';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger('Webhook');

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @Inject(Q_INBOUND) private readonly inboundQueue: Queue,
  ) {}

  /**
   * Generic dispatcher. Provider-specific parsing has already happened.
   */
  async handleParsedEvents(
    provider: WhatsappProvider,
    identifier: string,
    events: ParsedWebhookEvents,
  ): Promise<void> {
    // Quality + connection updates
    if (events.connection) {
      const acct = await this.findAccount(provider, events.connection.toAccountIdentifier ?? identifier);
      if (acct) {
        await this.prisma.whatsappAccount.update({
          where: { id: acct.id },
          data: { isConnected: events.connection.isConnected },
        });
      }
    }
    if (events.qualityUpdate) {
      const acct = await this.findAccount(provider, identifier);
      if (acct) {
        await this.prisma.whatsappAccount.update({
          where: { id: acct.id },
          data: {
            qualityRating: events.qualityUpdate.qualityRating ?? acct.qualityRating,
            messagingTier: events.qualityUpdate.messagingTier ?? acct.messagingTier,
          },
        });
        await this.prisma.whatsappQualityEvent.create({
          data: {
            whatsappAccountId: acct.id,
            kind: 'quality_update',
            payload: events.qualityUpdate as object,
          },
        });
      }
    }

    // Inbound messages
    for (const m of events.messages) {
      try {
        await this.ingestInbound(provider, m);
      } catch (e) {
        this.logger.warn(`ingest failed: ${(e as Error).message}`);
      }
    }

    // Delivery statuses (Cloud API only)
    for (const s of events.statuses) {
      await this.prisma.message
        .updateMany({
          where: { waMessageId: s.waMessageId },
          data: { isRead: s.status === 'read' || s.status === 'delivered' },
        })
        .catch(() => undefined);
    }
  }

  private async ingestInbound(provider: WhatsappProvider, m: InboundMessage): Promise<void> {
    const acct = await this.findAccount(provider, m.toAccountIdentifier);
    if (!acct) {
      this.logger.warn(`webhook for unknown ${provider} account: ${m.toAccountIdentifier}`);
      return;
    }
    if (m.waMessageId) {
      const dup = await this.prisma.message.findUnique({ where: { waMessageId: m.waMessageId } });
      if (dup) return;
    }
    if (!m.fromPhone) return;

    const contact = await this.prisma.contact.upsert({
      where: { clientId_phone: { clientId: acct.clientId, phone: m.fromPhone } },
      create: {
        clientId: acct.clientId,
        phone: m.fromPhone,
        name: m.pushName ?? null,
        lastSeenAt: new Date(),
      },
      update: { lastSeenAt: new Date(), name: m.pushName ?? undefined },
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        clientId: acct.clientId,
        contactId: contact.id,
        whatsappAccountId: acct.id,
        status: { in: ['OPEN', 'ASSIGNED', 'SNOOZED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          clientId: acct.clientId,
          contactId: contact.id,
          whatsappAccountId: acct.id,
        },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        waMessageId: m.waMessageId || null,
        direction: 'INBOUND',
        type: m.type,
        content: m.content,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    this.realtime.emitMessageCreated({
      clientId: acct.clientId,
      conversationId: conversation.id,
      message,
    });

    await this.inboundQueue.add(
      'process-inbound',
      { messageId: message.id, conversationId: conversation.id },
      { jobId: `msg:${message.id}` },
    );
  }

  private async findAccount(provider: WhatsappProvider, identifier: string) {
    if (provider === 'META_CLOUD') {
      return this.prisma.whatsappAccount.findFirst({
        where: { provider: 'META_CLOUD', phoneNumberId: identifier },
      });
    }
    return this.prisma.whatsappAccount.findFirst({
      where: { provider: 'EVOLUTION', instanceName: identifier },
    });
  }
}
