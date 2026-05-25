import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { TeamService } from './team.service';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './team.dto';
import type { Principal } from '../auth/principal';

@Controller('team')
@Roles('CLIENT', 'TEAM_MEMBER')
export class TeamController {
  constructor(private readonly svc: TeamService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Post() create(@Body() dto: CreateTeamMemberDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateTeamMemberDto, @CurrentPrincipal() p: Principal) { return this.svc.update(id, dto, p); }
  @Post(':id/suspend') suspend(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.setActive(id, false, p); }
  @Post(':id/activate') activate(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.setActive(id, true, p); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.remove(id, p); }
}
