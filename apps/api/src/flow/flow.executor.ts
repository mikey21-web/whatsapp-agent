import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Q_OUTBOUND } from '../queue/queue.module';
import type { FlowDoc, FlowNode, FlowContext } from './flow.types';
import type { FlowTrigger } from '@diyaa/db';

const MAX_NODES = 100;

@Injectable()
export class FlowExecutor {
  private readonly logger = new Logger('FlowExecutor');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(Q_OUTBOUND) private readonly outQueue: Queue,
  ) {}

  /**
   * Find every active flow for the client matching the trigger and run it.
   * Triggered from inbound worker, contact creation, deal stage change, etc.
   */
  async runForTrigger(args: {
    clientId: string;
    trigger: FlowTrigger;
    contactId: string;
    conversationId?: string;
    message?: string;
  }): Promise<void> {
    const flows = await this.prisma.flow.findMany({
      where: {
        clientId: args.clientId,
        trigger: args.trigger,
        isActive: true,
      },
    });
    for (const f of flows) {
      const doc: FlowDoc = { nodes: f.nodes as any, edges: f.edges as any };
      const trigger = doc.nodes.find((n) => n.kind === 'TRIGGER');
      if (!trigger) continue;

      // KEYWORD trigger: only proceed if the message matches the configured term.
      if (args.trigger === 'KEYWORD') {
        const kw = String(trigger.data.keyword ?? '').toLowerCase();
        const mode = String(trigger.data.match ?? 'contains').toLowerCase();
        const text = (args.message ?? '').toLowerCase();
        let matched = false;
        if (mode === 'exact') matched = text.trim() === kw;
        else if (mode === 'regex') {
          try {
            // ReDoS guard: block patterns with nested quantifiers that cause
            // catastrophic backtracking: (x+)+, (x+)*, (x|y)+, etc.
            if (isUnsafeRegex(trigger.data.keyword as string)) {
              this.logger.warn(`flow ${f.id}: potentially unsafe regex blocked`);
              matched = false;
            } else {
              matched = new RegExp(trigger.data.keyword as string, 'i').test(text);
            }
          }
          catch { matched = false; }
        } else matched = text.includes(kw);
        if (!matched) continue;
      }

      const ctx: FlowContext = {
        flowId: f.id,
        clientId: args.clientId,
        contactId: args.contactId,
        conversationId: args.conversationId,
        triggerEvent: args.trigger,
        message: args.message,
        vars: {},
      };
      try {
        await this.run(doc, trigger.id, ctx);
      } catch (e) {
        this.logger.warn(`flow ${f.id} failed: ${(e as Error).message}`);
      }
    }
  }

  /** Walk from a starting node, executing each node and following edges. */
  private async run(doc: FlowDoc, startNodeId: string, ctx: FlowContext): Promise<void> {
    const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
    let currentId: string | null = startNodeId;
    let steps = 0;
    while (currentId && steps++ < MAX_NODES) {
      const node = nodeMap.get(currentId);
      if (!node) break;
      const result = await this.execNode(node, ctx);
      currentId = nextNodeId(doc, node.id, result.branch);
      if (result.halt) break;
    }
  }

  private async execNode(
    node: FlowNode,
    ctx: FlowContext,
  ): Promise<{ branch?: 'true' | 'false'; halt?: boolean }> {
    switch (node.kind) {
      case 'TRIGGER':
      case 'END':
        return {};

      case 'SEND_MESSAGE': {
        const text = template(String(node.data.text ?? ''), ctx);
        if (!ctx.conversationId) return {};
        const msg = await this.prisma.message.create({
          data: {
            conversationId: ctx.conversationId,
            direction: 'OUTBOUND',
            type: 'TEXT',
            content: text,
          },
        });
        await this.outQueue.add('send', { messageId: msg.id }, { jobId: `out-${msg.id}` });
        return {};
      }

      case 'CONDITION': {
        const lhs = template(String(node.data.lhs ?? ''), ctx);
        const op = String(node.data.op ?? 'equals');
        const rhs = String(node.data.rhs ?? '');
        let result = false;
        switch (op) {
          case 'equals': result = lhs === rhs; break;
          case 'contains': result = lhs.toLowerCase().includes(rhs.toLowerCase()); break;
          case 'starts_with': result = lhs.toLowerCase().startsWith(rhs.toLowerCase()); break;
          case 'regex':
            try {
              if (isUnsafeRegex(rhs)) {
                this.logger.warn(`flow ${ctx.flowId}: unsafe regex in CONDITION node blocked`);
                result = false;
              } else {
                result = new RegExp(rhs, 'i').test(lhs);
              }
            } catch { result = false; }
            break;
        }
        return { branch: result ? 'true' : 'false' };
      }

      case 'DELAY': {
        // For now, in-process delay capped at 60s to avoid blocking workers.
        // Long delays should be handled by a dedicated scheduler (deferred).
        const ms = Math.min(Number(node.data.ms ?? 1000), 60_000);
        await new Promise((r) => setTimeout(r, ms));
        return {};
      }

      case 'ADD_TAG': {
        const tag = String(node.data.tag ?? '');
        if (!tag) return {};
        const c = await this.prisma.contact.findUnique({ where: { id: ctx.contactId } });
        if (!c) return {};
        if (!c.tags.includes(tag)) {
          await this.prisma.contact.update({
            where: { id: c.id },
            data: { tags: { set: [...c.tags, tag] } },
          });
        }
        return {};
      }

      case 'REMOVE_TAG': {
        const tag = String(node.data.tag ?? '');
        const c = await this.prisma.contact.findUnique({ where: { id: ctx.contactId } });
        if (!c) return {};
        await this.prisma.contact.update({
          where: { id: c.id },
          data: { tags: { set: c.tags.filter((t) => t !== tag) } },
        });
        return {};
      }

      case 'ASSIGN': {
        if (!ctx.conversationId) return {};
        const memberId = (node.data.teamMemberId as string | null) ?? null;
        await this.prisma.conversation.update({
          where: { id: ctx.conversationId },
          data: { assignedToId: memberId, status: memberId ? 'ASSIGNED' : 'OPEN' },
        });
        return {};
      }

      case 'UPDATE_CONTACT': {
        const updates = (node.data.fields as Record<string, unknown>) ?? {};
        await this.prisma.contact.update({
          where: { id: ctx.contactId },
          data: {
            ...(typeof updates.name === 'string' ? { name: updates.name } : {}),
            ...(typeof updates.email === 'string' ? { email: updates.email } : {}),
            ...(typeof updates.language === 'string' ? { language: updates.language } : {}),
            ...(typeof updates.stage === 'string' ? { stage: updates.stage } : {}),
          },
        });
        return {};
      }

      case 'CREATE_DEAL': {
        const pipelineId = String(node.data.pipelineId ?? '');
        const title = template(String(node.data.title ?? 'New deal'), ctx);
        if (!pipelineId) return {};
        const pipeline = await this.prisma.pipeline.findUnique({
          where: { id: pipelineId },
          include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
        });
        if (!pipeline || pipeline.clientId !== ctx.clientId || !pipeline.stages[0]) return {};
        const deal = await this.prisma.deal.create({
          data: {
            clientId: ctx.clientId,
            contactId: ctx.contactId,
            pipelineId: pipeline.id,
            stageId: pipeline.stages[0].id,
            title,
          },
        });
        await this.prisma.activity.create({
          data: { contactId: ctx.contactId, dealId: deal.id, type: 'DEAL_CREATED' },
        });
        ctx.vars.lastDealId = deal.id;
        return {};
      }

      case 'WEBHOOK': {
        const url = String(node.data.url ?? '');
        if (!url) return {};
        // SSRF protection: block private/loopback/metadata IP ranges.
        if (isSsrfUrl(url)) {
          this.logger.warn(`SSRF blocked: flow ${ctx.flowId} tried to call ${url}`);
          return {};
        }
        try {
          await axios.post(
            url,
            { contactId: ctx.contactId, conversationId: ctx.conversationId, vars: ctx.vars },
            { timeout: 10_000 },
          );
        } catch (e) {
          this.logger.warn(`webhook node failed: ${(e as Error).message}`);
        }
        return {};
      }

      case 'AI_RESPOND':
      case 'MOVE_DEAL_STAGE':
        // Plumbing left for next pass; safe no-op.
        return {};
    }
  }
}

function nextNodeId(doc: FlowDoc, fromId: string, branch?: 'true' | 'false'): string | null {
  const candidates = doc.edges.filter((e) => e.source === fromId);
  if (candidates.length === 0) return null;
  if (branch) {
    const branched = candidates.find((e) => e.branch === branch);
    if (branched) return branched.target;
  }
  return candidates[0]!.target;
}

/**
 * Block SSRF targets: loopback, private RFC-1918, link-local, and cloud
 * metadata endpoints. Rejects anything that doesn't parse as a valid URL.
 */
function isSsrfUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true; // unparseable → block
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return true;
  const h = url.hostname.toLowerCase();
  // Loopback (IPv4 and IPv6 — URL.hostname includes brackets for IPv6)
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') return true;
  // AWS/GCP/Azure metadata
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  // Private IPv4 ranges (simplified check)
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\./);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  return false;
}

function template(s: string, ctx: FlowContext): string {
  return s
    .replace(/\{\{\s*message\s*\}\}/gi, ctx.message ?? '')
    .replace(/\{\{\s*contact\.id\s*\}\}/gi, ctx.contactId)
    .replace(/\{\{\s*vars\.([\w]+)\s*\}\}/gi, (_, k) => String(ctx.vars[k] ?? ''));
}

/**
 * Heuristic ReDoS guard. Blocks patterns with:
 *  - Nested quantifiers: (x+)+, (x+)*, (x+)?
 *  - Alternation with quantifier: (a|b)+, (a|b)*
 *  - Repeated groups: (\w+)+
 *
 * Not exhaustive — a proper solution would use a regex complexity analyser
 * library. This covers the most common catastrophic backtracking patterns.
 */
function isUnsafeRegex(pattern: string): boolean {
  // Nested quantifier: group followed by quantifier, where group contains quantifier
  if (/\([^)]*[+*?][^)]*\)[+*?{]/.test(pattern)) return true;
  // Alternation with outer quantifier: (a|b)+
  if (/\([^)]*\|[^)]*\)[+*?{]/.test(pattern)) return true;
  return false;
}
