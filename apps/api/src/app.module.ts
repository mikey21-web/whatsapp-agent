import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AgencyModule } from './agency/agency.module';
import { ClientModule } from './client/client.module';
import { TeamModule } from './team/team.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConversationModule } from './conversation/conversation.module';
import { MessageModule } from './message/message.module';
import { ContactModule } from './contact/contact.module';
import { RealtimeModule } from './realtime/realtime.module';
import { QueueModule } from './queue/queue.module';
import { AiModule } from './ai/ai.module';
import { CrmModule } from './crm/crm.module';
import { FlowModule } from './flow/flow.module';
import { CampaignModule } from './campaign/campaign.module';
import { TemplateModule } from './template/template.module';
import { TemplatesMetaModule } from './templates-meta/templates-meta.module';
import { EmailModule } from './email/email.module';
import { BillingModule } from './billing/billing.module';
import { DomainModule } from './domain/domain.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { QuickReplyModule } from './quick-reply/quick-reply.module';
import { StubModule } from './stub/stub.module';
import { HealthModule } from './common/health.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { AuditInterceptor } from './common/audit.interceptor';
import { GlobalRateLimitMiddleware } from './common/global-rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
    BillingModule,
    DomainModule,
    RealtimeModule,
    AiModule,
    QueueModule,
    AuthModule,
    AgencyModule,
    ClientModule,
    TeamModule,
    WhatsappModule,
    WebhookModule,
    ContactModule,
    ConversationModule,
    MessageModule,
    CrmModule,
    FlowModule,
    CampaignModule,
    TemplateModule,
    TemplatesMetaModule,
    IntegrationsModule,
    AnalyticsModule,
    QuickReplyModule,
    HealthModule,
    StubModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        bodyParser.json({
          verify: (req: any, _res, buf: Buffer) => {
            req.rawBody = buf;
          },
        }),
      )
      .forRoutes('webhooks/razorpay', 'webhooks/whatsapp/meta_cloud/*');

    // Global per-IP rate limit on every HTTP route except health checks and webhooks.
    // Webhooks come from trusted external services (Evolution / Meta / Razorpay)
    // and have their own signature verification — throttling them would drop real traffic.
    consumer
      .apply(GlobalRateLimitMiddleware)
      .exclude(
        { path: 'healthz', method: RequestMethod.ALL },
        { path: 'readyz', method: RequestMethod.ALL },
        { path: 'webhooks/(.*)', method: RequestMethod.ALL },
        { path: 'domain/allowed', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
