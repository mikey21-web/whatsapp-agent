import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsIn, IsObject, IsString, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { TemplatesMetaService } from './templates-meta.service';
import type { Principal } from '../auth/principal';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;

class CreateTemplateDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() language!: string;
  @IsIn(CATEGORIES as unknown as string[]) category!: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  /// Meta `components` array, e.g. [{ type: 'BODY', text: 'Hello {{1}}' }, ...]
  @IsArray() components!: unknown[];
}

@Controller('whatsapp/accounts/:accountId/templates')
@Roles('CLIENT', 'TEAM_MEMBER')
export class TemplatesMetaController {
  constructor(private readonly svc: TemplatesMetaService) {}

  @Get() list(@Param('accountId') accountId: string, @CurrentPrincipal() p: Principal) {
    return this.svc.list(accountId, p);
  }

  @Post() create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateTemplateDto,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.svc.submit(accountId, dto, p);
  }

  @Post('sync') sync(@Param('accountId') accountId: string, @CurrentPrincipal() p: Principal) {
    return this.svc.syncFromMeta(accountId, p);
  }
}
