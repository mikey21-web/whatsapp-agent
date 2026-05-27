import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsString, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, LoginOrChallenge } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { AgencyRegisterDto, LoginDto, SmbSignupDto } from './auth.dto';
import { CurrentPrincipal, Public } from '../common/decorators';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import type { Principal } from './principal';
import { env } from '../config/env';

const REFRESH_COOKIE = 'diyaa_rt';

class RequestResetDto {
  @IsEmail() email!: string;
}
class ConfirmResetDto {
  @IsString() token!: string;
  @IsString() @MinLength(8) password!: string;
}
class VerifyEmailDto {
  @IsString() token!: string;
}
class MfaVerifyDto {
  @IsString() challenge!: string;
  @IsString() @MinLength(6) code!: string;
}
class SetMfaDto {
  @IsBoolean() enabled!: boolean;
}

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly reset: PasswordResetService,
  ) {}

  @Public() @RateLimit({ windowSec: 60, max: 10 }) @Post('superadmin/login')
  async superadminLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.loginSuperAdmin(dto.email, dto.password, meta(req));
    setRefreshCookie(res, r.refreshToken, r.refreshExpiresAt);
    return body(r);
  }

  @Public() @RateLimit({ windowSec: 60, max: 5 }) @Post('agency/register')
  async agencyRegister(@Body() dto: AgencyRegisterDto) { return this.auth.registerAgency(dto); }

  /**
   * Self-serve SMB signup. Public, rate-limited. Creates an Agency wrapper +
   * a paired Client and returns a fully-authenticated Client session — the
   * frontend should set the access token and route to /dashboard.
   */
  @Public() @RateLimit({ windowSec: 60, max: 5 }) @Post('signup')
  async signup(@Body() dto: SmbSignupDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.signupSmb(dto, meta(req));
    setRefreshCookie(res, r.refreshToken, r.refreshExpiresAt);
    return body(r);
  }

  @Public() @RateLimit({ windowSec: 60, max: 10 }) @Post('agency/login')
  async agencyLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.loginAgency(dto.email, dto.password, meta(req));
    return this.respondMaybeMfa(r, res);
  }

  @Public() @RateLimit({ windowSec: 60, max: 10 }) @Post('client/login')
  async clientLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.loginClient(dto.email, dto.password, meta(req));
    return this.respondMaybeMfa(r, res);
  }

  @Public() @RateLimit({ windowSec: 60, max: 10 }) @Post('team/login')
  async teamLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.loginTeam(dto.email, dto.password, meta(req));
    setRefreshCookie(res, r.refreshToken, r.refreshExpiresAt);
    return body(r);
  }

  @Public() @RateLimit({ windowSec: 60, max: 10 }) @Post('mfa/verify')
  async mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.verifyMfaAndLogin(dto.challenge, dto.code, meta(req));
    setRefreshCookie(res, r.refreshToken, r.refreshExpiresAt);
    return body(r);
  }

  @Public() @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!rt) return { error: { code: 'UNAUTHORIZED', message: 'No refresh token' } };
    const r = await this.auth.refresh(rt, meta(req));
    setRefreshCookie(res, r.refreshToken, r.refreshExpiresAt);
    return body(r);
  }

  @Public() @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.logout(rt);
    res.clearCookie(REFRESH_COOKIE, cookieOptions(new Date(0)));
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentPrincipal() principal: Principal) { return this.auth.me(principal); }

  // ── Password reset ──

  @Public() @RateLimit({ windowSec: 60, max: 5 }) @Post('password/request-reset')
  async requestReset(@Body() dto: RequestResetDto) {
    await this.reset.requestReset(dto.email);
    return { ok: true };
  }

  @Public() @RateLimit({ windowSec: 60, max: 5 }) @Post('password/confirm-reset')
  async confirmReset(@Body() dto: ConfirmResetDto) {
    await this.reset.confirmReset(dto.token, dto.password);
    return { ok: true };
  }

  // ── Email verification ──

  @Public() @RateLimit({ windowSec: 60, max: 10 }) @Post('email/verify')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.reset.confirmVerify(dto.token);
  }

  @Post('email/resend')
  async resendVerify(@CurrentPrincipal() principal: Principal) {
    if (principal.type !== 'AGENCY' && principal.type !== 'CLIENT') {
      return { ok: false };
    }
    await this.reset.sendVerifyEmail(principal.type, principal.id);
    return { ok: true };
  }

  // ── MFA toggle ──

  @Post('mfa/setting')
  async setMfa(@Body() dto: SetMfaDto, @CurrentPrincipal() p: Principal) {
    return this.auth.setMfa(p, dto.enabled);
  }

  // ── helpers ──

  private respondMaybeMfa(r: LoginOrChallenge, res: Response) {
    if ('mfaRequired' in r) return r;
    setRefreshCookie(res, r.refreshToken, r.refreshExpiresAt);
    return body(r);
  }
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie('diyaa_rt', token, cookieOptions(expiresAt));
}
function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    expires,
    path: '/auth',
  };
}
function meta(req: Request) {
  return {
    userAgent: req.headers['user-agent']?.toString().slice(0, 200),
    ip: req.ip,
  };
}
function body(r: { accessToken: string; expiresIn: number; principal: Principal }) {
  return { accessToken: r.accessToken, expiresIn: r.expiresIn, principal: r.principal };
}
