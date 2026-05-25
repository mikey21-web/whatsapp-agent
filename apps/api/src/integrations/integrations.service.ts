import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { decryptJson, encryptJson } from './crypto.util';
import { specFor } from './providers';
import type { IntegrationKind } from '@diyaa/db';
import type { Principal } from '../auth/principal';

const STATE_TTL_MS = 10 * 60_000;

interface OauthState {
  clientId: string;
  kind: IntegrationKind;
  shop?: string;
  expiresAt: number;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger('Integrations');

  constructor(private readonly prisma: PrismaService) {}

  list(p: Principal) {
    const clientId = clientOf(p);
    return this.prisma.integration.findMany({
      where: { clientId },
      select: {
        id: true,
        provider: true,
        isActive: true,
        connectedAt: true,
        lastSyncAt: true,
        metadata: true,
      },
      orderBy: { connectedAt: 'desc' },
    });
  }

  async startOauth(
    p: Principal,
    kind: IntegrationKind,
    extra: { shop?: string } = {},
  ): Promise<{ url: string }> {
    if (kind === 'TALLY') throw new ForbiddenException('Use /tally/connect for Tally');
    const clientId = clientOf(p);
    const spec = specFor(kind);
    if (!spec.clientId || !spec.clientSecret) {
      throw new ForbiddenException(`${spec.label} OAuth credentials not configured`);
    }
    const state = this.signState({
      clientId,
      kind,
      shop: extra.shop,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
    const redirectUri = `${env.API_PUBLIC_URL}/integrations/${kind.toLowerCase()}/callback`;
    return { url: spec.authUrl(state, redirectUri, extra) };
  }

  async finishOauth(
    kind: IntegrationKind,
    code: string,
    state: string,
    extra: { shop?: string } = {},
  ): Promise<{ clientId: string }> {
    const decoded = this.verifyState(state);
    if (!decoded) throw new ForbiddenException('Invalid or expired OAuth state');
    if (decoded.kind !== kind) throw new ForbiddenException('State mismatch');

    const spec = specFor(kind);
    const redirectUri = `${env.API_PUBLIC_URL}/integrations/${kind.toLowerCase()}/callback`;

    let tokenResponse: Record<string, unknown> = {};
    let metadata: Record<string, unknown> = {};

    switch (kind) {
      case 'SHOPIFY': {
        const shop = extra.shop ?? decoded.shop;
        if (!shop) throw new ForbiddenException('Missing shop');
        const { data } = await axios.post<{ access_token: string; scope: string }>(
          `https://${shop}/admin/oauth/access_token`,
          {
            client_id: spec.clientId,
            client_secret: spec.clientSecret,
            code,
          },
        );
        tokenResponse = data;
        metadata = { shop };
        break;
      }
      case 'GOOGLE_CALENDAR':
      case 'ZOHO': {
        const { data } = await axios.post<{
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
          api_domain?: string;
        }>(
          spec.tokenUrl,
          new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: spec.clientId,
            client_secret: spec.clientSecret,
            redirect_uri: redirectUri,
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        );
        tokenResponse = data;
        if (kind === 'ZOHO' && data.api_domain) metadata = { apiDomain: data.api_domain };
        break;
      }
      case 'TALLY':
        throw new ForbiddenException('Tally has no OAuth flow');
    }

    await this.upsertIntegration(decoded.clientId, kind, tokenResponse, metadata);
    return { clientId: decoded.clientId };
  }

  /** API-key style connection (used for Tally and as a fallback path). */
  async connectApiKey(
    p: Principal,
    kind: IntegrationKind,
    apiKey: string,
    metadata: Record<string, unknown> = {},
  ) {
    const clientId = clientOf(p);
    return this.upsertIntegration(clientId, kind, { apiKey }, metadata);
  }

  async disconnect(p: Principal, kind: IntegrationKind) {
    const clientId = clientOf(p);
    await this.prisma.integration.deleteMany({ where: { clientId, provider: kind } });
    return { ok: true };
  }

  async getCredentials<T = Record<string, unknown>>(
    clientId: string,
    kind: IntegrationKind,
  ): Promise<{ creds: T; metadata: Record<string, unknown> } | null> {
    const row = await this.prisma.integration.findUnique({
      where: { clientId_provider: { clientId, provider: kind } },
    });
    if (!row || !row.isActive) return null;
    return {
      creds: decryptJson<T>(row.credentials),
      metadata: row.metadata as Record<string, unknown>,
    };
  }

  async touchSync(clientId: string, kind: IntegrationKind) {
    await this.prisma.integration.update({
      where: { clientId_provider: { clientId, provider: kind } },
      data: { lastSyncAt: new Date() },
    });
  }

  private async upsertIntegration(
    clientId: string,
    provider: IntegrationKind,
    creds: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ) {
    const encrypted = encryptJson(creds);
    return this.prisma.integration.upsert({
      where: { clientId_provider: { clientId, provider } },
      create: {
        clientId,
        provider,
        credentials: encrypted,
        metadata: metadata as object,
        isActive: true,
      },
      update: {
        credentials: encrypted,
        metadata: metadata as object,
        isActive: true,
      },
    });
  }

  // ── State signing (compact HMAC + JSON) ──

  private signState(state: OauthState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const sig = createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): OauthState | null {
    try {
      const [payload, sig] = state.split('.');
      if (!payload || !sig) return null;
      const expected = createHmac('sha256', env.JWT_ACCESS_SECRET)
        .update(payload)
        .digest('base64url');
      if (sig.length !== expected.length) return null;
      if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OauthState;
      if (decoded.expiresAt < Date.now()) return null;
      return decoded;
    } catch {
      return null;
    }
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
