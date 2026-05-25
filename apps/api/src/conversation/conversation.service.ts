import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';
import type { ConversationStatus } from '@diyaa/db';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    principal: Principal,
    query: { status?: ConversationStatus; take?: number; skip?: number },
  ) {
    const clientId = this.requireClient(principal);
    const take = Math.min(query.take ?? 50, 200);
    const skip = query.skip ?? 0;
    const conversations = await this.prisma.conversation.findMany({
      where: { clientId, ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, type: true, direction: true, createdAt: true },
        },
      },
    });
    return conversations.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      whatsappAccountId: c.whatsappAccountId,
      contact: c.contact,
      status: c.status,
      isAIEnabled: c.isAIEnabled,
      assignedToId: c.assignedToId,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.messages[0]?.content ?? null,
      lastMessageType: c.messages[0]?.type ?? null,
      lastMessageDirection: c.messages[0]?.direction ?? null,
      createdAt: c.createdAt,
    }));
  }

  async get(id: string, principal: Principal) {
    const clientId = this.requireClient(principal);
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!c || c.clientId !== clientId) throw new NotFoundException();
    return c;
  }

  async setAIEnabled(id: string, isAIEnabled: boolean, principal: Principal) {
    await this.get(id, principal);
    return this.prisma.conversation.update({ where: { id }, data: { isAIEnabled } });
  }

  async assign(id: string, teamMemberId: string | null, principal: Principal) {
    await this.get(id, principal);
    return this.prisma.conversation.update({
      where: { id },
      data: {
        assignedToId: teamMemberId,
        status: teamMemberId ? 'ASSIGNED' : 'OPEN',
      },
    });
  }

  async resolve(id: string, principal: Principal) {
    await this.get(id, principal);
    return this.prisma.conversation.update({ where: { id }, data: { status: 'RESOLVED' } });
  }

  private requireClient(p: Principal): string {
    if (p.type === 'CLIENT') return p.id;
    if (p.type === 'TEAM_MEMBER') return p.clientId;
    throw new ForbiddenException();
  }
}
