import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLANS } from './plans';
import type { AgencyPlan } from '@diyaa/db';

/**
 * Enforces plan-based quotas. Called by services before performing actions
 * that count toward limits (creating clients, connecting numbers, sending msgs).
 */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the agency's plan and current period start (UTC, first day of month). */
  async getContext(agencyId: string): Promise<{ plan: AgencyPlan; periodStart: Date }> {
    const ag = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true },
    });
    if (!ag) throw new ForbiddenException('Agency not found');
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { plan: ag.plan, periodStart };
  }

  async assertCanAddClient(agencyId: string): Promise<void> {
    const { plan } = await this.getContext(agencyId);
    const limits = PLANS[plan];
    const count = await this.prisma.client.count({ where: { agencyId } });
    if (count >= limits.maxClients) {
      throw new ForbiddenException(
        `Plan ${limits.label} allows ${limits.maxClients} client(s). Upgrade to add more.`,
      );
    }
  }

  async assertCanAddNumber(clientId: string): Promise<void> {
    const c = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { agencyId: true },
    });
    if (!c) throw new ForbiddenException();
    const { plan } = await this.getContext(c.agencyId);
    const limits = PLANS[plan];
    const count = await this.prisma.whatsappAccount.count({ where: { clientId } });
    if (count >= limits.maxNumbersPerClient) {
      throw new ForbiddenException(
        `Plan ${limits.label} allows ${limits.maxNumbersPerClient} number(s) per client.`,
      );
    }
  }

  async assertCanAddAgent(clientId: string): Promise<void> {
    const c = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { agencyId: true },
    });
    if (!c) throw new ForbiddenException();
    const { plan } = await this.getContext(c.agencyId);
    const limits = PLANS[plan];
    if (limits.maxAgents === Number.MAX_SAFE_INTEGER) return;
    const count = await this.prisma.aIAgent.count({ where: { clientId } });
    if (count >= limits.maxAgents) {
      throw new ForbiddenException(
        `Plan ${limits.label} allows ${limits.maxAgents} AI agent(s). Upgrade to add more.`,
      );
    }
  }

  async assertCanAddContact(clientId: string): Promise<void> {
    const c = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { agencyId: true },
    });
    if (!c) throw new ForbiddenException();
    const { plan } = await this.getContext(c.agencyId);
    const limits = PLANS[plan];
    if (limits.maxContacts === Number.MAX_SAFE_INTEGER) return;
    const count = await this.prisma.contact.count({ where: { clientId } });
    if (count >= limits.maxContacts) {
      throw new ForbiddenException(
        `Plan ${limits.label} allows ${limits.maxContacts.toLocaleString()} contacts. Upgrade to add more.`,
      );
    }
  }

  async assertCanSendMessage(agencyId: string): Promise<void> {
    const { plan, periodStart } = await this.getContext(agencyId);
    const limits = PLANS[plan];
    if (limits.maxMessagesPerMonth === Number.MAX_SAFE_INTEGER) return;
    // Atomic increment-and-check: increment first, then verify we haven't exceeded.
    // This prevents the TOCTOU race where concurrent workers all read the same
    // count, all pass the check, and all send — blowing past the quota.
    const updated = await this.prisma.usageRecord.upsert({
      where: { agencyId_period: { agencyId, period: periodStart } },
      create: { agencyId, period: periodStart, messages: 1 },
      update: { messages: { increment: 1 } },
    });
    if (updated.messages > limits.maxMessagesPerMonth) {
      // Compensate: decrement back so the count stays accurate.
      await this.prisma.usageRecord.update({
        where: { agencyId_period: { agencyId, period: periodStart } },
        data: { messages: { decrement: 1 } },
      }).catch(() => undefined);
      throw new ForbiddenException(
        `Plan ${limits.label} monthly message quota (${limits.maxMessagesPerMonth.toLocaleString()}) exceeded.`,
      );
    }
  }

  async incrementMessages(agencyId: string, by = 1): Promise<void> {
    // No-op: assertCanSendMessage now handles the increment atomically.
    // Kept for backward compatibility with any direct callers.
    if (by <= 0) return;
    const { periodStart } = await this.getContext(agencyId);
    await this.prisma.usageRecord.upsert({
      where: { agencyId_period: { agencyId, period: periodStart } },
      create: { agencyId, period: periodStart, messages: by },
      update: { messages: { increment: by } },
    });
  }

  async getUsage(agencyId: string) {
    const { plan, periodStart } = await this.getContext(agencyId);
    const limits = PLANS[plan];
    const usage = await this.prisma.usageRecord.findUnique({
      where: { agencyId_period: { agencyId, period: periodStart } },
    });
    const [clients, numbers, agents, contacts] = await Promise.all([
      this.prisma.client.count({ where: { agencyId } }),
      this.prisma.whatsappAccount.count({ where: { client: { agencyId } } }),
      this.prisma.aIAgent.count({ where: { client: { agencyId } } }),
      this.prisma.contact.count({ where: { client: { agencyId } } }),
    ]);
    return {
      plan,
      periodStart,
      limits: {
        clients: limits.maxClients,
        numbersPerClient: limits.maxNumbersPerClient,
        messagesPerMonth: limits.maxMessagesPerMonth,
        agents: limits.maxAgents,
        contacts: limits.maxContacts,
      },
      current: {
        clients,
        numbers,
        agents,
        contacts,
        messages: usage?.messages ?? 0,
      },
    };
  }
}
