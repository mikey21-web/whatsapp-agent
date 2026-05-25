import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { env } from '../config/env';
import type { SubjectType } from './principal';

const RESET_TTL_MIN = 30;
const VERIFY_TTL_MIN = 60 * 24;
const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_COST = 12;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ── Password reset ──

  async requestReset(email: string): Promise<void> {
    const subject = await this.findSubjectByEmail(email);
    // Always succeed silently — never leak whether an account exists.
    if (!subject) return;
    const raw = randomBytes(32).toString('hex');
    const tokenHash = sha256(raw);
    await this.prisma.emailToken.create({
      data: {
        subjectType: subject.type,
        subjectId: subject.id,
        purpose: 'PASSWORD_RESET',
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000),
      },
    });
    const url = `${env.WEB_PUBLIC_URL}/reset-password?token=${raw}`;
    const tpl = this.email.passwordResetEmail({ name: subject.name, resetUrl: url });
    await this.email.send({ to: email, subject: 'Reset your diyaa.ai password', html: tpl });
  }

  async confirmReset(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new BadRequestException('Password too short');
    const tokenHash = sha256(token);
    const row = await this.prisma.emailToken.findUnique({ where: { tokenHash } });
    if (!row || row.purpose !== 'PASSWORD_RESET' || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.updatePassword(row.subjectType, row.subjectId, passwordHash),
      // Revoke all existing refresh tokens for this subject — forces re-login.
      this.prisma.refreshToken.updateMany({
        where: { subjectType: row.subjectType, subjectId: row.subjectId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // ── Email verification ──

  async sendVerifyEmail(subjectType: SubjectType, subjectId: string): Promise<void> {
    const subject = await this.findSubjectById(subjectType, subjectId);
    if (!subject) return;
    const raw = randomBytes(32).toString('hex');
    const tokenHash = sha256(raw);
    await this.prisma.emailToken.create({
      data: {
        subjectType,
        subjectId,
        purpose: 'EMAIL_VERIFY',
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFY_TTL_MIN * 60_000),
      },
    });
    const url = `${env.WEB_PUBLIC_URL}/verify-email?token=${raw}`;
    const tpl = this.email.verifyEmail({ name: subject.name, verifyUrl: url });
    await this.email.send({ to: subject.email, subject: 'Confirm your email', html: tpl });
  }

  async confirmVerify(token: string): Promise<{ ok: true }> {
    const tokenHash = sha256(token);
    const row = await this.prisma.emailToken.findUnique({ where: { tokenHash } });
    if (!row || row.purpose !== 'EMAIL_VERIFY' || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.markEmailVerified(row.subjectType, row.subjectId),
    ]);
    return { ok: true };
  }

  // ── MFA OTP ──

  async issueOtp(subjectType: SubjectType, subjectId: string, email: string): Promise<void> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = sha256(code);
    // Invalidate any pending OTPs for this subject.
    await this.prisma.otpCode.updateMany({
      where: { subjectType, subjectId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.otpCode.create({
      data: {
        subjectType,
        subjectId,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
      },
    });
    const tpl = this.email.otpEmail({ code, ttlMinutes: OTP_TTL_MIN });
    await this.email.send({ to: email, subject: 'Your diyaa.ai sign-in code', html: tpl });
  }

  async verifyOtp(
    subjectType: SubjectType,
    subjectId: string,
    code: string,
  ): Promise<boolean> {
    const codeHash = sha256(code);
    const row = await this.prisma.otpCode.findFirst({
      where: { subjectType, subjectId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.expiresAt < new Date() || row.attempts >= OTP_MAX_ATTEMPTS) {
      return false;
    }
    // Timing-safe comparison prevents timing oracle attacks on the OTP.
    const expected = Buffer.from(row.codeHash, 'hex');
    const provided = Buffer.from(codeHash, 'hex');
    const match = expected.length === provided.length && timingSafeEqual(expected, provided);
    if (!match) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }
    await this.prisma.otpCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return true;
  }

  // ── helpers ──

  private async findSubjectByEmail(
    email: string,
  ): Promise<{ type: SubjectType; id: string; name: string | null } | null> {
    const ag = await this.prisma.agency.findUnique({ where: { email } });
    if (ag) return { type: 'AGENCY', id: ag.id, name: ag.name };
    const c = await this.prisma.client.findUnique({ where: { email } });
    if (c) return { type: 'CLIENT', id: c.id, name: c.name };
    const t = await this.prisma.teamMember.findUnique({ where: { email } });
    if (t) return { type: 'TEAM_MEMBER', id: t.id, name: t.name };
    const sa = await this.prisma.superAdmin.findUnique({ where: { email } });
    if (sa) return { type: 'SUPER_ADMIN', id: sa.id, name: null };
    return null;
  }

  private async findSubjectById(
    type: SubjectType,
    id: string,
  ): Promise<{ email: string; name: string | null } | null> {
    switch (type) {
      case 'AGENCY': {
        const a = await this.prisma.agency.findUnique({ where: { id } });
        return a ? { email: a.email, name: a.name } : null;
      }
      case 'CLIENT': {
        const c = await this.prisma.client.findUnique({ where: { id } });
        return c ? { email: c.email, name: c.name } : null;
      }
      case 'TEAM_MEMBER': {
        const t = await this.prisma.teamMember.findUnique({ where: { id } });
        return t ? { email: t.email, name: t.name } : null;
      }
      case 'SUPER_ADMIN': {
        const s = await this.prisma.superAdmin.findUnique({ where: { id } });
        return s ? { email: s.email, name: null } : null;
      }
    }
  }

  private updatePassword(type: SubjectType, id: string, password: string) {
    switch (type) {
      case 'AGENCY':
        return this.prisma.agency.update({ where: { id }, data: { password } });
      case 'CLIENT':
        return this.prisma.client.update({ where: { id }, data: { password } });
      case 'TEAM_MEMBER':
        return this.prisma.teamMember.update({ where: { id }, data: { password } });
      case 'SUPER_ADMIN':
        return this.prisma.superAdmin.update({ where: { id }, data: { password } });
    }
  }

  private markEmailVerified(type: SubjectType, id: string) {
    const data = { emailVerifiedAt: new Date() };
    switch (type) {
      case 'AGENCY':
        return this.prisma.agency.update({ where: { id }, data });
      case 'CLIENT':
        return this.prisma.client.update({ where: { id }, data });
      // TeamMember + SuperAdmin don't track this in Phase 1.
      default:
        return this.prisma.agency.findUnique({ where: { id: 'noop' } }) as any;
    }
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
