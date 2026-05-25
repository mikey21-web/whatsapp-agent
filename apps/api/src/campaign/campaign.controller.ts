import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { CampaignService } from './campaign.service';
import type { Principal } from '../auth/principal';
import type { CampaignType } from '@diyaa/db';

const TYPES = ['BROADCAST', 'SEQUENCE', 'DRIP'] as const;

class CreateCampaignDto {
  @IsString() @MinLength(1) name!: string;
  @IsIn(TYPES as unknown as string[]) type!: CampaignType;
  @IsString() template!: string;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsString() scheduledAt?: string;
}

class StartCampaignDto {
  @IsOptional() @IsArray() tagFilter?: string[];
}

@Controller('campaigns')
@Roles('CLIENT', 'TEAM_MEMBER')
export class CampaignController {
  constructor(private readonly svc: CampaignService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Post() create(@Body() dto: CreateCampaignDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Post(':id/start') start(
    @Param('id') id: string,
    @Body() dto: StartCampaignDto,
    @CurrentPrincipal() p: Principal,
  ) { return this.svc.start(id, p, { tagFilter: dto.tagFilter }); }
  @Post(':id/pause') pause(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.pause(id, p); }
}
