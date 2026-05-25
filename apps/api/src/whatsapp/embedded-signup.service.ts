import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { encryptJson } from '../integrations/crypto.util';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

interface CompleteDto {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  phoneNumber?: string;
  displayName?: string;
}

interface DebugTokenResponse {
  data?: {
    is_valid?: boolean;
    granular_scopes?: { scope: string; target_ids?: string[] }[];
    expires_at?: number;
    user_id?: string;
  };
}

@Injectable()
export class EmbeddedSignupService {
  private readonly logger = new Logger('EmbeddedSignup');

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: PlanLimitsService,
  ) {}

  async complete(dto: CompleteDto, principal: Principal) {
    const clientId = clientOf(principal);
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      throw new ForbiddenException('Embedded signup not configured');
    }
    await this.limits.assertCanAddNumber(clientId);

    // 1. Exchange the auth code for an access token.
    const tokenRes = await axios.get<{
      access_token: string;
      token_type: string;
      expires_in?: number;
    }>(`${GRAPH_API}/oauth/access_token`, {
      params: {
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        code: dto.code,
        // The redirect_uri must match what was passed to FB.login(). Embedded
        // signup uses the special value below per Meta docs.
        redirect_uri: env.META_EMBEDDED_SIGNUP_REDIRECT_URI || 'https://www.facebook.com/connect/login_success.html',
      },
      timeout: 15_000,
    });
    const userToken = tokenRes.data.access_token;

    // 2. Verify the token actually has access to the WABA we were told about.
    const debugRes = await axios.get<DebugTokenResponse>(`${GRAPH_API}/debug_token`, {
      params: {
        input_token: userToken,
        access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}`,
      },
      timeout: 15_000,
    });
    if (!debugRes.data.data?.is_valid) {
      throw new ForbiddenException('Token validation failed');
    }
    const grantedWabaIds = (debugRes.data.data.granular_scopes ?? [])
      .filter((s) => s.scope === 'whatsapp_business_management' || s.scope === 'whatsapp_business_messaging')
      .flatMap((s) => s.target_ids ?? []);
    if (grantedWabaIds.length > 0 && !grantedWabaIds.includes(dto.wabaId)) {
      throw new ForbiddenException('WABA not in granted scopes');
    }

    // 3. Subscribe our webhook to the WABA so we receive inbound events.
    try {
      await axios.post(
        `${GRAPH_API}/${encodeURIComponent(dto.wabaId)}/subscribed_apps`,
        {},
        { headers: { Authorization: `Bearer ${userToken}` }, timeout: 15_000 },
      );
    } catch (e) {
      this.logger.warn(`subscribed_apps failed (already subscribed?): ${(e as Error).message}`);
    }

    // 4. Register the phone number with the Cloud API (sets PIN to 000000).
    try {
      await axios.post(
        `${GRAPH_API}/${encodeURIComponent(dto.phoneNumberId)}/register`,
        { messaging_product: 'whatsapp', pin: '000000' },
        { headers: { Authorization: `Bearer ${userToken}` }, timeout: 15_000 },
      );
    } catch (e) {
      this.logger.warn(`phone register failed (already registered?): ${(e as Error).message}`);
    }

    // 5. Fetch phone metadata to fill in display name + verified phone.
    let phoneNumber = dto.phoneNumber ?? '';
    let displayName = dto.displayName ?? '';
    try {
      const meta = await axios.get<{ verified_name?: string; display_phone_number?: string }>(
        `${GRAPH_API}/${encodeURIComponent(dto.phoneNumberId)}`,
        {
          headers: { Authorization: `Bearer ${userToken}` },
          params: { fields: 'verified_name,display_phone_number' },
          timeout: 15_000,
        },
      );
      phoneNumber = (meta.data.display_phone_number ?? phoneNumber).replace(/\D/g, '');
      displayName = meta.data.verified_name ?? displayName;
    } catch (e) {
      this.logger.warn(`phone metadata fetch failed: ${(e as Error).message}`);
    }
    if (!phoneNumber) phoneNumber = dto.phoneNumberId;

    // 6. Persist locally. Use a synthetic instanceName for Cloud accounts.
    const dup = await this.prisma.whatsappAccount.findUnique({ where: { phoneNumberId: dto.phoneNumberId } });
    if (dup) throw new ConflictException('phoneNumberId already connected');

    const webhookUrl = `${env.WEBHOOK_PUBLIC_URL}/webhooks/whatsapp/meta_cloud/${encodeURIComponent(dto.phoneNumberId)}`;
    const account = await this.prisma.whatsappAccount.create({
      data: {
        clientId,
        provider: 'META_CLOUD',
        instanceName: `meta_${dto.phoneNumberId}`,
        phoneNumber,
        displayName,
        webhookUrl,
        wabaId: dto.wabaId,
        phoneNumberId: dto.phoneNumberId,
        accessTokenEnc: encryptJson({
          access_token: userToken,
          expires_at: tokenRes.data.expires_in
            ? Date.now() + tokenRes.data.expires_in * 1000
            : undefined,
        }),
        msgsPerMinute: 60,
        // Cloud accounts are sanctioned — skip warmup mode.
        warmupMode: false,
        isConnected: true,
      },
    });

    return {
      id: account.id,
      provider: account.provider,
      phoneNumber: account.phoneNumber,
      displayName: account.displayName,
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
    };
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
