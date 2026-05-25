import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import type { WhatsappProvider } from '@diyaa/db';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { WhatsappService } from './whatsapp.service';
import type { Principal } from '../auth/principal';

const PROVIDERS = ['EVOLUTION', 'META_CLOUD'] as const;

class CreateAccountDto {
  @IsOptional() @IsIn(PROVIDERS as unknown as string[]) provider?: WhatsappProvider;
  @IsString() @MinLength(1) instanceName!: string;
  @IsString() phoneNumber!: string;
  @IsOptional() @IsString() displayName?: string;
  // Meta-only:
  @IsOptional() @IsString() wabaId?: string;
  @IsOptional() @IsString() phoneNumberId?: string;
  @IsOptional() @IsString() accessToken?: string;
}

class PauseDto { @IsBoolean() paused!: boolean; }

class SetLimitsDto {
  @IsOptional() @IsInt() msgsPerMinute?: number;
  @IsOptional() @IsInt() msgsPerDay?: number;
  @IsOptional() @IsBoolean() warmupMode?: boolean;
}

@Controller('whatsapp/accounts')
@Roles('CLIENT', 'TEAM_MEMBER')
export class WhatsappController {
  constructor(private readonly svc: WhatsappService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Post() create(@Body() dto: CreateAccountDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Get(':id/qr') qr(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.qr(id, p); }
  @Get(':id/status') status(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.status(id, p); }
  @Post(':id/pause') pause(@Param('id') id: string, @Body() dto: PauseDto, @CurrentPrincipal() p: Principal) {
    return this.svc.setOutboundPaused(id, dto.paused, p);
  }
  @Patch(':id/limits') limits(@Param('id') id: string, @Body() dto: SetLimitsDto, @CurrentPrincipal() p: Principal) {
    return this.svc.setLimits(id, dto, p);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.remove(id, p); }
}
