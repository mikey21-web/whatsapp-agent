import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(p: Principal, days: number) {
    const clientId = clientOf(p);
    const since = startOfDayUtc(daysAgo(days));

    const [
      messagesIn,
      messagesOut,
      aiHandled,
      conversationsOpen,
      conversationsResolved,
      newContacts,
      dealsCreated,
      dealsWon,
      dealsLost,
      revenue,
      campaignsSent,
    ] = await Promise.all([
      this.prisma.message.count({
        where: {
          conversation: { clientId },
          direction: 'INBOUND',
          createdAt: { gte: since },
        },
      }),
      this.prisma.message.count({
        where: {
          conversation: { clientId },
          direction: 'OUTBOUND',
          createdAt: { gte: since },
        },
      }),
      this.prisma.message.count({
        where: {
          conversation: { clientId },
          direction: 'OUTBOUND',
          sentByAI: true,
          createdAt: { gte: since },
        },
      }),
      this.prisma.conversation.count({
        where: { clientId, status: { in: ['OPEN', 'ASSIGNED'] } },
      }),
      this.prisma.conversation.count({
        where: { clientId, status: 'RESOLVED', createdAt: { gte: since } },
      }),
      this.prisma.contact.count({ where: { clientId, createdAt: { gte: since } } }),
      this.prisma.deal.count({ where: { clientId, createdAt: { gte: since } } }),
      this.prisma.deal.count({
        where: { clientId, status: 'WON', closedAt: { gte: since } },
      }),
      this.prisma.deal.count({
        where: { clientId, status: 'LOST', closedAt: { gte: since } },
      }),
      this.prisma.deal.aggregate({
        where: { clientId, status: 'WON', closedAt: { gte: since } },
        _sum: { value: true },
      }),
      this.prisma.campaign.count({
        where: { clientId, status: 'SENT', sentAt: { gte: since } },
      }),
    ]);

    const totalOutbound = messagesOut || 1;
    return {
      windowDays: days,
      messages: { inbound: messagesIn, outbound: messagesOut, aiHandledPct: Math.round((aiHandled / totalOutbound) * 100) },
      conversations: { open: conversationsOpen, resolvedInWindow: conversationsResolved },
      contacts: { newInWindow: newContacts },
      deals: {
        createdInWindow: dealsCreated,
        wonInWindow: dealsWon,
        lostInWindow: dealsLost,
        revenueInWindow: revenue._sum.value ?? 0,
        winRatePct:
          dealsWon + dealsLost > 0
            ? Math.round((dealsWon / (dealsWon + dealsLost)) * 100)
            : 0,
      },
      campaigns: { sentInWindow: campaignsSent },
    };
  }

  async messagesByDay(p: Principal, days: number) {
    const clientId = clientOf(p);
    const since = startOfDayUtc(daysAgo(days));
    // Use raw SQL for efficient day bucketing.
    const rows = await this.prisma.$queryRawUnsafe<
      { day: Date; direction: string; count: bigint }[]
    >(
      `SELECT date_trunc('day', m."createdAt") AS day, m.direction, COUNT(*)::bigint AS count
         FROM "Message" m
         JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE c."clientId" = $1 AND m."createdAt" >= $2
        GROUP BY day, m.direction
        ORDER BY day ASC`,
      clientId,
      since,
    );
    const map = new Map<string, { day: string; inbound: number; outbound: number }>();
    for (let i = 0; i < days; i++) {
      const d = startOfDayUtc(daysAgo(days - 1 - i));
      const key = d.toISOString().slice(0, 10);
      map.set(key, { day: key, inbound: 0, outbound: 0 });
    }
    for (const r of rows) {
      const key = r.day.toISOString().slice(0, 10);
      const slot = map.get(key) ?? { day: key, inbound: 0, outbound: 0 };
      if (r.direction === 'INBOUND') slot.inbound = Number(r.count);
      else slot.outbound = Number(r.count);
      map.set(key, slot);
    }
    return Array.from(map.values());
  }

  async teamPerformance(p: Principal, days: number) {
    const clientId = clientOf(p);
    const since = daysAgo(days);
    const rows = await this.prisma.message.groupBy({
      by: ['sentByAgentId'],
      where: {
        conversation: { clientId },
        direction: 'OUTBOUND',
        sentByAgentId: { not: null },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    });
    const memberIds = rows.map((r) => r.sentByAgentId).filter((x): x is string => !!x);
    const members = memberIds.length
      ? await this.prisma.teamMember.findMany({
          where: { id: { in: memberIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const byId = new Map(members.map((m) => [m.id, m]));
    return rows
      .map((r) => ({
        agentId: r.sentByAgentId,
        name: r.sentByAgentId ? byId.get(r.sentByAgentId)?.name ?? '—' : '—',
        role: r.sentByAgentId ? byId.get(r.sentByAgentId)?.role ?? null : null,
        messages: r._count._all,
      }))
      .sort((a, b) => b.messages - a.messages);
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
