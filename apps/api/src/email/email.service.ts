import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');
  private readonly http: AxiosInstance | null;

  constructor() {
    this.http = env.RESEND_API_KEY
      ? axios.create({
          baseURL: 'https://api.resend.com',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'content-type': 'application/json',
          },
          timeout: 15_000,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.http !== null;
  }

  async send(args: SendArgs): Promise<{ id: string | null }> {
    if (!this.http) {
      this.logger.warn(`RESEND_API_KEY not set; would send "${args.subject}" to ${args.to}`);
      // Dev mode: log to console so the OTP flow remains testable.
      this.logger.log(`[DEV-EMAIL] To: ${args.to} | Subject: ${args.subject}\n${stripTags(args.html)}`);
      return { id: null };
    }
    try {
      const { data } = await this.http.post<{ id: string }>('/emails', {
        from: args.from ?? env.EMAIL_FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html,
      });
      return { id: data.id };
    } catch (e) {
      this.logger.warn(`Resend send failed: ${(e as Error).message}`);
      return { id: null };
    }
  }

  // ── Templates ──

  passwordResetEmail(args: { name?: string | null; resetUrl: string }) {
    return wrap(
      `<h2>Password reset</h2>
       <p>Hi ${escape(args.name ?? 'there')},</p>
       <p>You requested to reset your diyaa.ai password. The link below is valid for 30 minutes.</p>
       <p><a href="${args.resetUrl}" style="background:#6366f1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Reset password</a></p>
       <p style="color:#64748b;font-size:12px">If you didn't request this, ignore this email.</p>`,
    );
  }

  verifyEmail(args: { name?: string | null; verifyUrl: string }) {
    return wrap(
      `<h2>Confirm your email</h2>
       <p>Hi ${escape(args.name ?? 'there')},</p>
       <p>Click below to confirm this is your email address. The link expires in 24 hours.</p>
       <p><a href="${args.verifyUrl}" style="background:#6366f1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Verify email</a></p>`,
    );
  }

  otpEmail(args: { code: string; ttlMinutes: number }) {
    return wrap(
      `<h2>Your sign-in code</h2>
       <p style="font-size:32px;letter-spacing:6px;font-weight:600;font-family:ui-monospace,monospace">${args.code}</p>
       <p>This code expires in ${args.ttlMinutes} minutes. Don't share it with anyone.</p>`,
    );
  }
}

function wrap(inner: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;color:#0f172a">
    <div style="font-size:18px;font-weight:600;margin-bottom:24px">diyaa.ai</div>
    ${inner}
    <p style="color:#94a3b8;font-size:11px;margin-top:32px">diyaa.ai · WhatsApp AI for Indian SMBs</p>
  </body></html>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
