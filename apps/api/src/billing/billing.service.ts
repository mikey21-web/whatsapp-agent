import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AgencyPlan } from '@diyaa/db';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayClient } from './razorpay.client';
import { PLANS } from './plans';
import { PlanLimitsService } from './plan-limits.service';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

@Injectable()
export class BillingService {
  private readonly logger = new Logger('Billing');

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClient,
    private readonly limits: PlanLimitsService,
  ) {}

  async getStatus(p: Principal) {
    const agencyId = this.requireAgency(p);
    const [sub, usage] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { agencyId } }),
      this.limits.getUsage(agencyId),
    ]);
    return { subscription: sub, usage };
  }

  async checkout(plan: AgencyPlan, p: Principal): Promise<{ subscriptionId: string; shortUrl: string | null }> {
    const agencyId = this.requireAgency(p);
    if (plan === 'FREE') {
      // FREE has no Razorpay subscription. Cancel any existing paid sub and
      // mark the agency as on FREE.
      const sub = await this.prisma.subscription.findUnique({ where: { agencyId } });
      if (sub?.razorpaySubId) {
        await this.razorpay.cancelSubscription(sub.razorpaySubId).catch(() => undefined);
      }
      await this.prisma.subscription.deleteMany({ where: { agencyId } });
      await this.prisma.agency.update({ where: { id: agencyId }, data: { plan: 'FREE' } });
      return { subscriptionId: '', shortUrl: null };
    }
    if (!this.razorpay.isConfigured()) {
      throw new ForbiddenException('Billing not configured on this deployment');
    }
    const planLimits = PLANS[plan];
    if (!planLimits.razorpayPlanIdEnvKey) {
      throw new ForbiddenException(`Plan ${plan} is not purchasable`);
    }
    const planId = env[planLimits.razorpayPlanIdEnvKey];
    if (!planId) throw new ForbiddenException(`No Razorpay plan configured for ${plan}`);

    const sub = await this.razorpay.createSubscription({
      planId,
      notes: { agencyId, plan },
    });
    await this.prisma.subscription.upsert({
      where: { agencyId },
      create: {
        agencyId,
        razorpaySubId: sub.id,
        razorpayCustomerId: sub.customer_id ?? null,
        plan,
        status: 'TRIALING',
        currentPeriodEnd: new Date(sub.current_end * 1000),
      },
      update: {
        razorpaySubId: sub.id,
        razorpayCustomerId: sub.customer_id ?? null,
        plan,
        status: 'TRIALING',
        currentPeriodEnd: new Date(sub.current_end * 1000),
      },
    });
    return { subscriptionId: sub.id, shortUrl: sub.short_url ?? null };
  }

  async cancel(p: Principal): Promise<{ ok: true }> {
    const agencyId = this.requireAgency(p);
    const sub = await this.prisma.subscription.findUnique({ where: { agencyId } });
    if (!sub?.razorpaySubId) throw new NotFoundException('No active subscription');
    await this.razorpay.cancelSubscription(sub.razorpaySubId);
    await this.prisma.subscription.update({
      where: { agencyId },
      data: { status: 'CANCELLED' },
    });
    return { ok: true };
  }

  /**
   * Apply state from a verified Razorpay webhook event.
   * Returns true if a row was updated, false if the subscription is unknown.
   */
  async applyWebhook(event: {
    event: string;
    payload?: {
      subscription?: { entity?: { id?: string; status?: string; current_end?: number; plan_id?: string } };
      payment_link?: { entity?: { id?: string; status?: string; reference_id?: string; notes?: Record<string, string> } };
      payment?: { entity?: { id?: string; amount?: number } };
    };
  }): Promise<boolean> {
    // Payment link events: paid → log activity on the contact.
    if (event.event?.startsWith('payment_link.')) {
      const link = event.payload?.payment_link?.entity;
      if (!link?.id) return false;
      const contactId = link.notes?.contactId;
      const conversationId = link.notes?.conversationId;
      if (!contactId) return false;
      await this.prisma.activity.create({
        data: {
          contactId,
          type: 'NOTE_ADDED',
          metadata: {
            kind: 'payment_link',
            event: event.event,
            paymentLinkId: link.id,
            status: link.status,
            referenceId: link.reference_id,
            conversationId,
            amountPaise: event.payload?.payment?.entity?.amount ?? null,
          },
        },
      }).catch(() => undefined);
      this.logger.log(`payment_link ${link.id} → ${event.event}`);
      return true;
    }

    const sub = event.payload?.subscription?.entity;
    const subId = sub?.id;
    if (!subId) return false;
    const existing = await this.prisma.subscription.findUnique({
      where: { razorpaySubId: subId },
    });
    if (!existing) return false;

    const status = mapStatus(sub?.status);
    const currentPeriodEnd =
      typeof sub?.current_end === 'number' ? new Date(sub.current_end * 1000) : existing.currentPeriodEnd;

    let graceUntil = existing.graceUntil;
    if (status === 'PAST_DUE' && !graceUntil) {
      graceUntil = new Date(Date.now() + 7 * 86_400_000); // 7 day grace
    }
    if (status === 'ACTIVE') graceUntil = null;

    // Suspend agency on hard cancel after grace.
    let isActiveOverride: boolean | undefined;
    if (status === 'CANCELLED') isActiveOverride = false;

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: { status, currentPeriodEnd, graceUntil },
    });

    if (isActiveOverride === false) {
      await this.prisma.agency.update({
        where: { id: existing.agencyId },
        data: { isActive: false },
      });
    }

    this.logger.log(`Razorpay webhook ${event.event} → subscription ${subId} ⇒ ${status}`);
    return true;
  }

  private requireAgency(p: Principal): string {
    // For self-served SMBs the user is a CLIENT but they own the whole
    // Agency wrapper, so resolve through the principal.agencyId. Pure agency
    // resellers come in with type === 'AGENCY' and we use their id directly.
    if (p.type === 'AGENCY') return p.id;
    if (p.type === 'CLIENT' && p.agencyId) return p.agencyId;
    if (p.type === 'TEAM_MEMBER' && p.agencyId) return p.agencyId;
    throw new ForbiddenException('Workspace context required');
  }
}

function mapStatus(s?: string) {
  switch (s) {
    case 'active':
    case 'authenticated':
    case 'completed':
      return 'ACTIVE' as const;
    case 'created':
    case 'pending':
      return 'TRIALING' as const;
    case 'halted':
    case 'paused':
      return 'PAST_DUE' as const;
    case 'cancelled':
    case 'expired':
      return 'CANCELLED' as const;
    default:
      return 'ACTIVE' as const;
  }
}
