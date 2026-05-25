import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { encryptJson } from './crypto.util';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

interface GoogleCreds {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
}

@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly prisma: PrismaService,
  ) {}

  async createEvent(
    p: Principal,
    args: { summary: string; startsAt: string; endsAt: string; attendeeEmail?: string },
  ) {
    const clientId = clientOf(p);
    const access = await this.getAccessToken(clientId);
    const { data } = await axios.post<{ id: string; htmlLink: string }>(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        summary: args.summary,
        start: { dateTime: args.startsAt },
        end: { dateTime: args.endsAt },
        ...(args.attendeeEmail ? { attendees: [{ email: args.attendeeEmail }] } : {}),
      },
      { headers: { Authorization: `Bearer ${access}` }, timeout: 15_000 },
    );
    await this.integrations.touchSync(clientId, 'GOOGLE_CALENDAR');
    return data;
  }

  private async getAccessToken(clientId: string): Promise<string> {
    const row = await this.integrations.getCredentials<GoogleCreds>(clientId, 'GOOGLE_CALENDAR');
    if (!row) throw new NotFoundException('Google Calendar not connected');
    const c = row.creds;
    const now = Date.now();
    if (c.access_token && c.expires_at && c.expires_at > now + 60_000) return c.access_token;
    if (!c.refresh_token) return c.access_token;

    const { data } = await axios.post<{ access_token: string; expires_in: number }>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: c.refresh_token,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const refreshed: GoogleCreds = {
      ...c,
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in - 60) * 1000,
    };
    await this.prisma.integration.update({
      where: { clientId_provider: { clientId, provider: 'GOOGLE_CALENDAR' } },
      data: { credentials: encryptJson(refreshed) },
    });
    return data.access_token;
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
