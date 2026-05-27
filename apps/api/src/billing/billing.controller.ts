import { Body, Controller, ForbiddenException, Get, Headers, Post, Req } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import { CurrentPrincipal, Public, Roles } from '../common/decorators';
import { BillingService } from './billing.service';
import { RazorpayClient } from './razorpay.client';
import type { Principal } from '../auth/principal';
import type { AgencyPlan } from '@diyaa/db';
import { PLANS, PLAN_ORDER } from './plans';

const PLAN_IDS = ['FREE', 'STARTER', 'GROWTH', 'SCALE'] as const;

class CheckoutDto {
  @IsIn(PLAN_IDS as unknown as string[]) plan!: AgencyPlan;
}

/**
 * Public marketing endpoint. Returns the plan catalog so the pricing page
 * can render without hard-coding values in the frontend. Safe to expose:
 * no secrets, just labels, prices, and limits already shown to users.
 */
@Controller('plans')
export class PlansController {
  @Public()
  @Get()
  list() {
    return PLAN_ORDER.map((id) => {
      const p = PLANS[id];
      return {
        id,
        label: p.label,
        priceInr: p.priceInr,
        highlights: p.highlights,
        limits: {
          messagesPerMonth: p.maxMessagesPerMonth,
          contacts: p.maxContacts,
          agents: p.maxAgents,
          numbers: p.maxNumbersPerClient,
        },
      };
    });
  }
}

@Controller('billing')
@Roles('AGENCY', 'CLIENT')
export class BillingController {
  constructor(
    private readonly svc: BillingService,
    private readonly razorpay: RazorpayClient,
  ) {}

  @Get('status') status(@CurrentPrincipal() p: Principal) { return this.svc.getStatus(p); }

  @Post('checkout') checkout(@Body() dto: CheckoutDto, @CurrentPrincipal() p: Principal) {
    return this.svc.checkout(dto.plan, p);
  }

  @Post('cancel') cancel(@CurrentPrincipal() p: Principal) { return this.svc.cancel(p); }
}

@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  constructor(
    private readonly svc: BillingService,
    private readonly razorpay: RazorpayClient,
  ) {}

  @Public()
  @Post()
  async handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: any,
  ) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    await this.svc.applyWebhook(body);
    return { ok: true };
  }
}
