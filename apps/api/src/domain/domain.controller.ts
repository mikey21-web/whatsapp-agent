import { Body, Controller, Delete, Get, Post, Query, Res } from '@nestjs/common';
import { IsString } from 'class-validator';
import type { Response } from 'express';
import { CurrentPrincipal, Public, Roles } from '../common/decorators';
import { DomainService } from './domain.service';
import type { Principal } from '../auth/principal';

class SetDomainDto {
  @IsString() hostname!: string;
}

@Controller()
export class DomainController {
  constructor(private readonly svc: DomainService) {}

  /**
   * Public lookup used by the web app to apply agency branding based on host.
   * No auth required since branding is public anyway.
   */
  @Public()
  @Get('domain/resolve')
  resolve(@Query('host') host: string) {
    return this.svc.resolve(host);
  }

  /**
   * Caddy `on_demand_tls.ask` endpoint. Returns 200 if we'll allow the cert,
   * otherwise 4xx and Caddy refuses. Caddy will hit this on every new SNI.
   */
  @Public()
  @Get('domain/allowed')
  async allowed(@Query('domain') domain: string, @Res() res: Response) {
    const ok = await this.svc.isDomainAllowed(domain ?? '');
    if (ok) return res.status(200).send('ok');
    return res.status(403).send('domain not registered');
  }

  // ── Agency self-service ──

  @Roles('AGENCY')
  @Post('agency/domain')
  set(@Body() dto: SetDomainDto, @CurrentPrincipal() p: Principal) {
    return this.svc.setCustomDomain(p, dto.hostname);
  }

  @Roles('AGENCY')
  @Delete('agency/domain')
  clear(@CurrentPrincipal() p: Principal) {
    return this.svc.clearCustomDomain(p);
  }

  @Roles('AGENCY')
  @Get('agency/domain/verify')
  verify(@CurrentPrincipal() p: Principal) {
    return this.svc.verifyDns(p);
  }
}
