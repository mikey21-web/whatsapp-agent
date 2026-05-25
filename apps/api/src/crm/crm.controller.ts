import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { PipelineService } from './pipeline.service';
import { DealService } from './deal.service';
import type { Principal } from '../auth/principal';
import type { DealStatus } from '@diyaa/db';

class CreatePipelineDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsArray() stages?: { name: string; color?: string }[];
}
class AddStageDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() color?: string;
}
class ReorderStagesDto {
  @IsArray() stageIds!: string[];
}
class CreateDealDto {
  @IsString() @MinLength(1) title!: string;
  @IsString() contactId!: string;
  @IsString() pipelineId!: string;
  @IsOptional() @IsString() stageId?: string;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() currency?: string;
}
class MoveStageDto {
  @IsString() stageId!: string;
}
class UpdateStatusDto {
  @IsIn(['OPEN', 'WON', 'LOST']) status!: DealStatus;
}
class AddNoteDto {
  @IsString() @MinLength(1) content!: string;
}

@Controller('pipelines')
@Roles('CLIENT', 'TEAM_MEMBER')
export class PipelineController {
  constructor(
    private readonly pipes: PipelineService,
    private readonly deals: DealService,
  ) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.pipes.list(p); }
  @Post() create(@Body() dto: CreatePipelineDto, @CurrentPrincipal() p: Principal) { return this.pipes.create(dto, p); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.pipes.remove(id, p); }

  @Post(':id/stages') addStage(@Param('id') id: string, @Body() dto: AddStageDto, @CurrentPrincipal() p: Principal) {
    return this.pipes.addStage(id, dto, p);
  }
  @Patch(':id/stages/order') reorder(
    @Param('id') id: string,
    @Body() dto: ReorderStagesDto,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.pipes.reorderStages(id, dto.stageIds, p);
  }

  @Get(':id/board') board(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.deals.board(id, p);
  }
}

@Controller('deals')
@Roles('CLIENT', 'TEAM_MEMBER')
export class DealController {
  constructor(private readonly svc: DealService) {}

  @Get() list(@CurrentPrincipal() p: Principal, @Query('pipelineId') pipelineId?: string) {
    return this.svc.list(p, { pipelineId });
  }
  @Post() create(@Body() dto: CreateDealDto, @CurrentPrincipal() p: Principal) {
    return this.svc.create(dto, p);
  }
  @Patch(':id/stage') moveStage(@Param('id') id: string, @Body() dto: MoveStageDto, @CurrentPrincipal() p: Principal) {
    return this.svc.moveStage(id, dto.stageId, p);
  }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentPrincipal() p: Principal) {
    return this.svc.updateStatus(id, dto.status, p);
  }
  @Post(':id/notes') addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @CurrentPrincipal() p: Principal) {
    return this.svc.addNote(id, dto.content, p);
  }
}

@Controller('contacts/:contactId/timeline')
@Roles('CLIENT', 'TEAM_MEMBER')
export class TimelineController {
  constructor(private readonly deals: DealService) {}
  @Get() get(@Param('contactId') contactId: string, @CurrentPrincipal() p: Principal) {
    return this.deals.timeline(contactId, p);
  }
}
