import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';
import type { AIAgent, Message } from '@diyaa/db';
import { AnthropicClient, ChatMessage } from './anthropic.client';
import { RagService } from './rag.service';

const HISTORY_WINDOW = 12;
const MAX_OUTPUT_TOKENS = 600;

interface AgentResponseInput {
  conversationId: string;
}

export interface AgentResponse {
  reply: string | null;
  handoff: boolean;
  reason: string | null;
  agentId: string | null;
}

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger('AiAgent');

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicClient,
    private readonly rag: RagService,
  ) {}

  /** CRUD scoped to client. */
  async list(p: Principal) {
    const clientId = requireClient(p);
    return this.prisma.aIAgent.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, p: Principal) {
    const clientId = requireClient(p);
    const a = await this.prisma.aIAgent.findUnique({ where: { id } });
    if (!a || a.clientId !== clientId) throw new NotFoundException();
    return a;
  }

  async create(
    dto: {
      name: string;
      persona: string;
      systemPrompt: string;
      language?: string[];
      handoffKeywords?: string[];
      knowledgeBaseId?: string | null;
      isActive?: boolean;
    },
    p: Principal,
  ) {
    const clientId = requireClient(p);
    if (dto.knowledgeBaseId) {
      const kb = await this.prisma.knowledgeBase.findUnique({
        where: { id: dto.knowledgeBaseId },
        select: { clientId: true },
      });
      if (!kb || kb.clientId !== clientId) throw new ForbiddenException();
    }
    return this.prisma.aIAgent.create({
      data: {
        clientId,
        name: dto.name,
        persona: dto.persona,
        systemPrompt: dto.systemPrompt,
        language: dto.language ?? ['en'],
        handoffKeywords: dto.handoffKeywords ?? [],
        knowledgeBaseId: dto.knowledgeBaseId ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<Parameters<AiAgentService['create']>[0]>, p: Principal) {
    await this.get(id, p);
    return this.prisma.aIAgent.update({ where: { id }, data: dto });
  }

  async remove(id: string, p: Principal) {
    await this.get(id, p);
    await this.prisma.aIAgent.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Generate a response for an inbound message. Called by the inbound BullMQ worker.
   * Returns the reply or a handoff signal.
   */
  async respond(input: AgentResponseInput): Promise<AgentResponse> {
    if (!this.anthropic.isConfigured()) {
      return { reply: null, handoff: false, reason: 'AI not configured', agentId: null };
    }

    const conv = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: { contact: true, client: true },
    });
    if (!conv || !conv.isAIEnabled) {
      return { reply: null, handoff: false, reason: 'AI disabled for conversation', agentId: null };
    }

    // Pick the first active AI agent for this client. Future: per-conversation routing.
    const agent = await this.prisma.aIAgent.findFirst({
      where: { clientId: conv.clientId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!agent) {
      return { reply: null, handoff: false, reason: 'No active agent', agentId: null };
    }

    const history = await this.prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
    });
    const ordered = [...history].reverse();
    let lastUserMessage = null as (typeof ordered)[number] | null;
    for (let i = ordered.length - 1; i >= 0; i--) {
      const m = ordered[i];
      if (m && m.direction === 'INBOUND') {
        lastUserMessage = m;
        break;
      }
    }
    if (!lastUserMessage) {
      return { reply: null, handoff: false, reason: 'No inbound message', agentId: agent.id };
    }

    const userText = (lastUserMessage.transcription ?? lastUserMessage.content ?? '').trim();
    if (!userText) {
      return { reply: null, handoff: false, reason: 'Empty content', agentId: agent.id };
    }

    // Handoff keyword detection (case-insensitive contains).
    const lower = userText.toLowerCase();
    const matched = agent.handoffKeywords.find((k) => k && lower.includes(k.toLowerCase()));
    if (matched) {
      await this.disableAi(conv.id);
      return {
        reply:
          'Got it. I’ll connect you with our team — someone will reply here shortly. Thanks for your patience.',
        handoff: true,
        reason: `keyword:${matched}`,
        agentId: agent.id,
      };
    }

    // RAG retrieval.
    let kbBlock = '';
    if (agent.knowledgeBaseId) {
      const chunks = await this.rag.retrieve(agent.knowledgeBaseId, userText, 5);
      if (chunks.length > 0) {
        kbBlock =
          '\n\nKNOWLEDGE BASE CONTEXT:\n' +
          chunks
            .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`)
            .join('\n---\n');
      }
    }

    const system = buildSystemPrompt(agent, conv.client.businessName, kbBlock);
    const messages: ChatMessage[] = ordered.map((m) => ({
      role: m.direction === 'INBOUND' ? 'user' : 'assistant',
      content: m.transcription ?? m.content ?? '[non-text message]',
    }));

    try {
      const result = await this.anthropic.complete({
        system,
        messages,
        maxTokens: MAX_OUTPUT_TOKENS,
      });
      return { reply: result.text.trim(), handoff: false, reason: null, agentId: agent.id };
    } catch (e) {
      this.logger.warn(`Anthropic call failed: ${(e as Error).message}`);
      return { reply: null, handoff: false, reason: 'AI error', agentId: agent.id };
    }
  }

  private async disableAi(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { isAIEnabled: false, status: 'OPEN' },
    });
  }
}

function buildSystemPrompt(agent: AIAgent, businessName: string, kbBlock: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const langs = agent.language.join(', ');
  return [
    `You are ${agent.name}, a ${agent.persona} for ${businessName}.`,
    '',
    `LANGUAGE: Respond in the same language the customer writes. Supported: ${langs}.`,
    'If the customer writes in Hindi, respond in Hindi. If Telugu, respond in Telugu. Otherwise English.',
    '',
    'YOUR ROLE:',
    agent.systemPrompt,
    kbBlock,
    '',
    'RULES:',
    '1. Never claim to be a human. If asked, say you are an AI assistant.',
    '2. If you cannot answer something, say "Let me connect you with our team" and stop.',
    '3. Keep responses concise. Max 3 sentences unless explaining something complex.',
    '4. Never share pricing unless it is in the knowledge base.',
    '5. End qualification conversations with a clear next step.',
    '',
    `TODAY: ${today}`,
  ].join('\n');
}

function requireClient(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
