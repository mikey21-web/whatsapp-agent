import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Q_OUTBOUND } from '../queue/queue.module';
import type { Principal } from '../auth/principal';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @Inject(Q_OUTBOUND) private readonly outbound: Queue,
  ) {}

  async list(
    conversationId: string,
    principal: Principal,
    query: { take?: number; before?: string },
  ) {
    const clientId = this.requireClient(principal);
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || conv.clientId !== clientId) throw new NotFoundException();
    const take = Math.min(query.take ?? 50, 200);
    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async send(dto: { conversationId: string; content: string }, principal: Principal) {
    const clientId = this.requireClient(principal);
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { whatsappAccount: true, contact: true },
    });
    if (!conv || conv.clientId !== clientId) throw new NotFoundException();
    const sentByAgentId = principal.type === 'TEAM_MEMBER' ? principal.id : null;
    const msg = await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: dto.content,
        sentByAgentId,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: msg.createdAt },
    });
    this.realtime.emitMessageCreated({
      clientId: conv.clientId,
      conversationId: conv.id,
      message: msg,
    });
    await this.outbound.add('send', { messageId: msg.id }, { jobId: `out:${msg.id}` });
    return msg;
  }

  private requireClient(p: Principal): string {
    if (p.type === 'CLIENT') return p.id;
    if (p.type === 'TEAM_MEMBER') return p.clientId;
    throw new ForbiddenException();
  }
}
