import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { PasswordResetService } from './password-reset.service';
import type { Principal, SubjectType } from './principal';
import { env } from '../config/env';
import { AgencyRegisterDto } from './auth.dto';

const BCRYPT_COST = 12;

interface LoginMeta {
  userAgent?: string;
  ip?: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  expiresIn: number;
  principal: Principal;
}

interface MfaChallenge {
  mfaRequired: true;
  challenge: string;
}

type LoginOrChallenge = LoginResult | MfaChallenge;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly reset: PasswordResetService,
  ) {}

  async loginSuperAdmin(email: string, password: string, meta: LoginMeta): Promise<LoginResult> {
    const sa = await this.prisma.superAdmin.findUnique({ where: { email } });
    if (!sa || !(await bcrypt.compare(password, sa.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const principal: Principal = { type: 'SUPER_ADMIN', id: sa.id };
    return this.finalizeLogin(principal, 'SUPER_ADMIN', sa.id, meta);
  }

  async loginAgency(email: string, password: string, meta: LoginMeta): Promise<LoginOrChallenge> {
    const ag = await this.prisma.agency.findUnique({ where: { email } });
    if (!ag || !ag.isActive || !(await bcrypt.compare(password, ag.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (ag.mfaEnabled) {
      await this.reset.issueOtp('AGENCY', ag.id, ag.email);
      return { mfaRequired: true, challenge: makeChallenge('AGENCY', ag.id) };
    }
    const principal: Principal = { type: 'AGENCY', id: ag.id };
    return this.finalizeLogin(principal, 'AGENCY', ag.id, meta);
  }

  async loginClient(email: string, password: string, meta: LoginMeta): Promise<LoginOrChallenge> {
    const c = await this.prisma.client.findUnique({
      where: { email },
      include: { agency: true },
    });
    if (!c || !c.isActive || !(await bcrypt.compare(password, c.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!c.agency.isActive) throw new ForbiddenException('Agency suspended');
    if (c.mfaEnabled) {
      await this.reset.issueOtp('CLIENT', c.id, c.email);
      return { mfaRequired: true, challenge: makeChallenge('CLIENT', c.id) };
    }
    const principal: Principal = { type: 'CLIENT', id: c.id, agencyId: c.agencyId };
    return this.finalizeLogin(principal, 'CLIENT', c.id, meta);
  }

  async loginTeam(email: string, password: string, meta: LoginMeta): Promise<LoginResult> {
    const t = await this.prisma.teamMember.findUnique({
      where: { email },
      include: { client: { include: { agency: true } } },
    });
    if (!t || !t.isActive || !(await bcrypt.compare(password, t.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!t.client.isActive) throw new ForbiddenException('Client suspended');
    if (!t.client.agency.isActive) throw new ForbiddenException('Agency suspended');
    const principal: Principal = {
      type: 'TEAM_MEMBER',
      id: t.id,
      clientId: t.clientId,
      agencyId: t.client.agencyId,
      role: t.role,
    };
    return this.finalizeLogin(principal, 'TEAM_MEMBER', t.id, meta);
  }

  async verifyMfaAndLogin(
    challenge: string,
    code: string,
    meta: LoginMeta,
  ): Promise<LoginResult> {
    const decoded = decodeChallenge(challenge);
    if (!decoded) throw new UnauthorizedException('Invalid challenge');
    const ok = await this.reset.verifyOtp(decoded.type, decoded.id, code);
    if (!ok) throw new UnauthorizedException('Invalid or expired code');
    const principal = await this.principalFor(decoded.type, decoded.id);
    if (!principal) throw new UnauthorizedException('Subject not found');
    return this.finalizeLogin(principal, decoded.type, decoded.id, meta);
  }

  async registerAgency(dto: AgencyRegisterDto): Promise<{ id: string }> {
    if (!env.ALLOW_AGENCY_SIGNUP) throw new ForbiddenException('Self-signup disabled');
    const existing = await this.prisma.agency.findFirst({
      where: { OR: [{ email: dto.email }, { slug: dto.slug }] },
    });
    if (existing) throw new ConflictException('Email or slug already in use');
    const hash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const ag = await this.prisma.agency.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
        slug: dto.slug,
        brandColor: dto.brandColor ?? '#000000',
      },
      select: { id: true },
    });
    // Fire-and-forget: send verification email.
    void this.reset.sendVerifyEmail('AGENCY', ag.id);
    return ag;
  }

  async refresh(refreshToken: string, meta: LoginMeta): Promise<LoginResult> {
    let rotated;
    try {
      rotated = await this.tokens.rotate(refreshToken, meta);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const principal = await this.principalFor(rotated.subjectType, rotated.subjectId);
    if (!principal) throw new UnauthorizedException('Subject not found');
    const access = await this.tokens.issueAccess(principal);
    return {
      accessToken: access.token,
      refreshToken: rotated.raw,
      refreshExpiresAt: rotated.expiresAt,
      expiresIn: access.expiresIn,
      principal,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.tokens.revoke(refreshToken);
  }

  async me(principal: Principal): Promise<Principal> {
    return principal;
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  async setMfa(principal: Principal, enabled: boolean): Promise<{ mfaEnabled: boolean }> {
    if (principal.type === 'AGENCY') {
      await this.prisma.agency.update({
        where: { id: principal.id },
        data: { mfaEnabled: enabled },
      });
    } else if (principal.type === 'CLIENT') {
      await this.prisma.client.update({
        where: { id: principal.id },
        data: { mfaEnabled: enabled },
      });
    } else {
      throw new ForbiddenException('MFA only supported for agency and client accounts');
    }
    return { mfaEnabled: enabled };
  }

  private async finalizeLogin(
    principal: Principal,
    subjectType: SubjectType,
    subjectId: string,
    meta: LoginMeta,
  ): Promise<LoginResult> {
    const access = await this.tokens.issueAccess(principal);
    const refresh = await this.tokens.issueRefresh(subjectType, subjectId, meta);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      principal,
    };
  }

  private async principalFor(type: SubjectType, id: string): Promise<Principal | null> {
    switch (type) {
      case 'SUPER_ADMIN': {
        const sa = await this.prisma.superAdmin.findUnique({ where: { id } });
        return sa ? { type: 'SUPER_ADMIN', id: sa.id } : null;
      }
      case 'AGENCY': {
        const a = await this.prisma.agency.findUnique({ where: { id } });
        return a && a.isActive ? { type: 'AGENCY', id: a.id } : null;
      }
      case 'CLIENT': {
        const c = await this.prisma.client.findUnique({
          where: { id },
          include: { agency: true },
        });
        if (!c || !c.isActive || !c.agency.isActive) return null;
        return { type: 'CLIENT', id: c.id, agencyId: c.agencyId };
      }
      case 'TEAM_MEMBER': {
        const t = await this.prisma.teamMember.findUnique({
          where: { id },
          include: { client: { include: { agency: true } } },
        });
        if (!t || !t.isActive || !t.client.isActive || !t.client.agency.isActive) return null;
        return {
          type: 'TEAM_MEMBER',
          id: t.id,
          clientId: t.clientId,
          agencyId: t.client.agencyId,
          role: t.role,
        };
      }
    }
  }
}

function makeChallenge(type: SubjectType, id: string): string {
  const payload = Buffer.from(JSON.stringify({ t: type, i: id, e: Date.now() + 10 * 60_000 })).toString('base64url');
  // HMAC-sign the payload so it cannot be forged.
  const sig = createHmac('sha256', env.JWT_ACCESS_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function decodeChallenge(c: string): { type: SubjectType; id: string } | null {
  try {
    const [payload, sig] = c.split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', env.JWT_ACCESS_SECRET).update(payload).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      t: SubjectType;
      i: string;
      e: number;
    };
    if (parsed.e < Date.now()) return null;
    return { type: parsed.t, id: parsed.i };
  } catch {
    return null;
  }
}

export type { LoginOrChallenge, MfaChallenge };
