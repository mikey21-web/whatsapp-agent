import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { ShopifyService } from './shopify.service';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ShopifyService, GoogleCalendarService],
  exports: [IntegrationsService, ShopifyService, GoogleCalendarService],
})
export class IntegrationsModule {}
