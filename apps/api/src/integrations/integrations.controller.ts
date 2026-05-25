import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { CurrentPrincipal, Public, Roles } from '../common/decorators';
import { IntegrationsService } from './integrations.service';
import { ShopifyService } from './shopify.service';
import { GoogleCalendarService } from './google-calendar.service';
import type { Principal } from '../auth/principal';
import type { IntegrationKind } from '@diyaa/db';
import { env } from '../config/env';

const KINDS = ['SHOPIFY', 'ZOHO', 'GOOGLE_CALENDAR', 'TALLY'] as const;

class ApiKeyConnectDto {
  @IsString() apiKey!: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly svc: IntegrationsService,
    private readonly shopify: ShopifyService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  // ── List + Disconnect (auth-protected) ──

  @Roles('CLIENT', 'TEAM_MEMBER')
  @Get()
  list(@CurrentPrincipal() p: Principal) {
    return this.svc.list(p);
  }

  @Roles('CLIENT', 'TEAM_MEMBER')
  @Delete(':kind')
  disconnect(@Param('kind') kind: string, @CurrentPrincipal() p: Principal) {
    const k = kind.toUpperCase() as IntegrationKind;
    if (!KINDS.includes(k as any)) throw new BadRequestException('Unknown provider');
    return this.svc.disconnect(p, k);
  }

  // ── OAuth start (auth-protected) ──

  @Roles('CLIENT', 'TEAM_MEMBER')
  @Get(':kind/connect')
  start(
    @Param('kind') kind: string,
    @Query('shop') shop: string | undefined,
    @CurrentPrincipal() p: Principal,
  ) {
    const k = kind.toUpperCase() as IntegrationKind;
    if (!KINDS.includes(k as any)) throw new BadRequestException('Unknown provider');
    return this.svc.startOauth(p, k, { shop });
  }

  // ── Tally (manual API key) ──

  @Roles('CLIENT', 'TEAM_MEMBER')
  @Post('tally/connect')
  tally(@Body() dto: ApiKeyConnectDto, @CurrentPrincipal() p: Principal) {
    return this.svc.connectApiKey(p, 'TALLY', dto.apiKey, dto.metadata ?? {});
  }

  // ── OAuth callbacks (public; verified via signed state) ──

  @Public()
  @Get('shopify/callback')
  async shopifyCb(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('shop') shop: string,
    @Query('hmac') hmac: string,
    @Res() res: Response,
  ) {
    if (!this.shopify.verifyShopifyHmac({ code, state, shop, hmac })) {
      return res.status(403).send('Invalid HMAC');
    }
    await this.svc.finishOauth('SHOPIFY', code, state, { shop });
    return res.redirect(`${env.WEB_PUBLIC_URL}/dashboard/integrations?connected=shopify`);
  }

  @Public()
  @Get('google_calendar/callback')
  async googleCb(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    await this.svc.finishOauth('GOOGLE_CALENDAR', code, state);
    return res.redirect(`${env.WEB_PUBLIC_URL}/dashboard/integrations?connected=google`);
  }

  @Public()
  @Get('zoho/callback')
  async zohoCb(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    await this.svc.finishOauth('ZOHO', code, state);
    return res.redirect(`${env.WEB_PUBLIC_URL}/dashboard/integrations?connected=zoho`);
  }

  // ── Provider operations (auth-protected) ──

  @Roles('CLIENT', 'TEAM_MEMBER')
  @Get('shopify/orders/:phone')
  shopifyOrders(@Param('phone') phone: string, @CurrentPrincipal() p: Principal) {
    return this.shopify.findOrdersByPhone(p, phone);
  }

  @Roles('CLIENT', 'TEAM_MEMBER')
  @Post('google_calendar/events')
  createEvent(
    @Body() body: { summary: string; startsAt: string; endsAt: string; attendeeEmail?: string },
    @CurrentPrincipal() p: Principal,
  ) {
    return this.calendar.createEvent(p, body);
  }
}
