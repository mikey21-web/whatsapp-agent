import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import type { AccessTokenPayload, Principal, SubjectType } from './principal';

const REFRESH_TTL_MS = parseDuration(env.REFRESH_TTL);

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issueAccess(principal: Principal): Promise<{ token: string; expiresIn: number }> {
    const payload: AccessTokenPayload = {
      sub: principal.id,
      type: principal.type,
      ...(principal.type === 'CLIENT' ? { agencyId: principal.agencyId } : {}),
      ...(principal.type === 'TEAM_MEMBER'
        ? {
            agencyId: principal.agencyId,
            clientId: principal.clientId,
            role: principal.role,
          }
        : {}),
    };
    const token = await this.jwt.signAsync(payload);
    return { token, expiresIn: parseDuration(env.ACCESS_TTL) / 1000 };
  }

  async issueRefresh(
    subjectType: SubjectType,
    subjectId: string,
    meta: { userAgent?: string; ip?: string; familyId?: string } = {},
  ): Promise<{ token: string; familyId: string; expiresAt: Date }> {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = sha256(raw);
    const familyId = meta.familyId ?? randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        subjectType,
        subjectId,
        familyId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return { token: raw, familyId, expiresAt };
  }

  async rotate(
    rawToken: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ subjectType: SubjectType; subjectId: string; raw: string; expiresAt: Date }> {
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) throw new Error('TOKEN_NOT_FOUND');

    if (existing.revokedAt || existing.expiresAt < new Date()) {
      // Reuse / expired — revoke entire family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new Error('TOKEN_REUSE_DETECTED');
    }

    const next = await this.issueRefresh(existing.subjectType, existing.subjectId, {
      ...meta,
      familyId: existing.familyId,
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: sha256(next.token) },
    });

    return {
      subjectType: existing.subjectType,
      subjectId: existing.subjectId,
      raw: next.token,
      expiresAt: next.expiresAt,
    };
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = sha256(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parseDuration(str: string): number {
  const m = /^(\d+)([smhd])$/.exec(str.trim());
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      return n * 60_000;
  }
}
