import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { ConversationService } from './conversation.service';
import type { Principal } from '../auth/principal';
import type { ConversationStatus } from '@diyaa/db';

class SetAIDto {
  @IsBoolean() isAIEnabled!: boolean;
}
class AssignDto {
  @IsOptional() @IsString() teamMemberId?: string | null;
}

@Controller('conversations')
@Roles('CLIENT', 'TEAM_MEMBER')
export class ConversationController {
  constructor(private readonly svc: ConversationService) {}

  @Get() list(
    @CurrentPrincipal() p: Principal,
    @Query('status') status?: ConversationStatus,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.svc.list(p, {
      status,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id') get(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.svc.get(id, p);
  }

  @Patch(':id/ai') setAi(
    @Param('id') id: string,
    @Body() dto: SetAIDto,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.svc.setAIEnabled(id, dto.isAIEnabled, p);
  }

  @Post(':id/assign') assign(
    @Param('id') id: string,
    @Body() dto: AssignDto,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.svc.assign(id, dto.teamMemberId ?? null, p);
  }

  @Post(':id/resolve') resolve(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.svc.resolve(id, p);
  }
}
