import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { FlowService } from './flow.service';
import type { Principal } from '../auth/principal';
import type { FlowTrigger } from '@diyaa/db';
import type { FlowDoc } from './flow.types';

const TRIGGERS = [
  'INBOUND_MESSAGE',
  'KEYWORD',
  'NEW_CONTACT',
  'DEAL_STAGE_CHANGE',
  'SCHEDULED',
  'WEBHOOK',
] as const;

class CreateFlowDto {
  @IsString() @MinLength(1) name!: string;
  @IsIn(TRIGGERS as unknown as string[]) trigger!: FlowTrigger;
  @IsObject() doc!: FlowDoc;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateFlowDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsObject() doc?: FlowDoc;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('flows')
@Roles('CLIENT', 'TEAM_MEMBER')
export class FlowController {
  constructor(private readonly svc: FlowService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Get(':id') get(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.get(id, p); }
  @Post() create(@Body() dto: CreateFlowDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateFlowDto, @CurrentPrincipal() p: Principal) { return this.svc.update(id, dto, p); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.remove(id, p); }
}
