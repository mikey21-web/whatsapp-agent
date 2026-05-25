import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { EmbeddedSignupService } from './embedded-signup.service';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

class CompleteSignupDto {
  /// Auth code returned by FB.login() after user completes embedded signup.
  @IsString() code!: string;
  /// WABA + phone number ids exposed in the embedded-signup response payload.
  @IsString() wabaId!: string;
  @IsString() phoneNumberId!: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() displayName?: string;
}

@Controller('whatsapp/embedded-signup')
@Roles('CLIENT', 'TEAM_MEMBER')
export class EmbeddedSignupController {
  constructor(private readonly svc: EmbeddedSignupService) {}

  /**
   * Returns the Meta config the frontend needs to launch the embedded signup
   * dialog (FB.login with `config_id`). Public to authenticated users only —
   * the actual app secret never leaves the backend.
   */
  @Get('config')
  config() {
    return {
      appId: env.META_APP_ID,
      configId: env.META_EMBEDDED_SIGNUP_CONFIG_ID,
      graphVersion: 'v22.0',
      enabled: !!(env.META_APP_ID && env.META_APP_SECRET && env.META_EMBEDDED_SIGNUP_CONFIG_ID),
    };
  }

  /**
   * Exchanges the OAuth code for a long-lived token, registers the phone number
   * with WhatsApp Cloud API, subscribes our webhook, and creates the local
   * `WhatsappAccount` row.
   */
  @Post('complete')
  complete(@Body() dto: CompleteSignupDto, @CurrentPrincipal() p: Principal) {
    return this.svc.complete(dto, p);
  }
}
