import { Global, Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController, PlansController, RazorpayWebhookController } from './billing.controller';
import { RazorpayClient } from './razorpay.client';
import { PlanLimitsService } from './plan-limits.service';
import { PaymentLinksService } from './payment-links.service';
import { PaymentLinksController } from './payment-links.controller';

@Global()
@Module({
  controllers: [BillingController, RazorpayWebhookController, PaymentLinksController, PlansController],
  providers: [BillingService, RazorpayClient, PlanLimitsService, PaymentLinksService],
  exports: [BillingService, RazorpayClient, PlanLimitsService, PaymentLinksService],
})
export class BillingModule {}
