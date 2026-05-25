import { Body, Controller, ForbiddenException, Get, Headers, Post, Req } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import { CurrentPrincipal, Public, Roles } from '../common/decorators';
import { BillingService } from './billing.service';
import { RazorpayClient } from './razorpay.client';
import type { Principal } from '../auth/principal';
import type { AgencyPlan } from '@diyaa/db';

const PLANS = ['STARTER', 'GROWTH', 'SCALE'] as const;

class CheckoutDto {
  @IsIn(PLANS as unknown as string[]) plan!: AgencyPlan;
}

@Controller('billing')
@Roles('AGENCY')
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
