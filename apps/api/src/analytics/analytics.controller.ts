import { Controller, Get, Query } from '@nestjs/common';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { AnalyticsService } from './analytics.service';
import type { Principal } from '../auth/principal';

@Controller('analytics')
@Roles('CLIENT', 'TEAM_MEMBER')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentPrincipal() p: Principal, @Query('days') days?: string) {
    const n = Math.max(1, Math.min(90, Number(days ?? 30)));
    return this.svc.overview(p, n);
  }

  @Get('messages-by-day')
  byDay(@CurrentPrincipal() p: Principal, @Query('days') days?: string) {
    const n = Math.max(1, Math.min(90, Number(days ?? 30)));
    return this.svc.messagesByDay(p, n);
  }

  @Get('agents')
  agents(@CurrentPrincipal() p: Principal, @Query('days') days?: string) {
    const n = Math.max(1, Math.min(90, Number(days ?? 30)));
    return this.svc.teamPerformance(p, n);
  }
}
