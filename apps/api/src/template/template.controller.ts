import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { TemplateService } from './template.service';
import type { Principal } from '../auth/principal';
import type { Vertical } from '@diyaa/db';

const VERTICALS = [
  'REAL_ESTATE',
  'CLINIC',
  'COACHING',
  'D2C',
  'HOSPITALITY',
  'EDUCATION',
  'FINANCE',
  'GENERAL',
] as const;

class ApplyTemplateDto {
  @IsIn(VERTICALS as unknown as string[]) vertical!: Vertical;
}

@Controller('templates')
@Roles('CLIENT', 'TEAM_MEMBER')
export class TemplateController {
  constructor(private readonly svc: TemplateService) {}

  @Get() list() { return this.svc.list(); }

  @Post('apply') apply(@Body() dto: ApplyTemplateDto, @CurrentPrincipal() p: Principal) {
    return this.svc.apply(dto.vertical, p);
  }
}
