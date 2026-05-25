import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { decryptJson, encryptJson } from '../integrations/crypto.util';
import type {
  ConnectionUpdate,
  InboundMessage,
  ParsedWebhookEvents,
  ProviderAccount,
  SendResult,
  SendTemplateArgs,
  SendTextArgs,
  WhatsappProviderImpl,
} from './provider.types';
import type { MessageType } from '@diyaa/db';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

interface MetaToken {
  access_token: string;
  /** Optional refresh token for system-user style flows. */
  refresh_token?: string;
  expires_at?: number;
}

@Injectable()
export class MetaCloudProvider implements WhatsappProviderImpl {
  readonly kind = 'META_CLOUD' as const;
  private readonly logger = new Logger('Provider:MetaCloud');

  // ── Lifecycle ──────────────────────────────────────────────────

  async getQR(): Promise<null> {
    return null;
  }

  async getStatus(account: ProviderAccount) {
    if (!account.phoneNumberId) return { status: 'unknown' };
    const token = this.tokenFor(account);
    try {
      const { data } = await axios.get<{
        verified_name?: string;
        quality_rating?: string;
        messaging_limit_tier?: string;
        code_verification_status?: string;
        display_phone_number?: string;
      }>(`${GRAPH_API}/${encodeURIComponent(account.phoneNumberId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { fields: 'verified_name,quality_rating,messaging_limit_tier,code_verification_status,display_phone_number' },
        timeout: 15_000,
      });
      return {
        status: data.code_verification_status ?? 'connected',
        qualityRating: data.quality_rating,
        messagingTier: data.messaging_limit_tier,
      };
    } catch (e) {
      this.logger.warn(`Cloud API status check failed: ${(e as Error).message}`);
      return { status: 'error' };
    }
  }

  async sendText(account: ProviderAccount, args: SendTextArgs): Promise<SendResult> {
    if (!account.phoneNumberId) throw new ForbiddenException('phoneNumberId required');
    const token = this.tokenFor(account);
    const { data } = await axios.post<{ messages: { id: string }[] }>(
      `${GRAPH_API}/${encodeURIComponent(account.phoneNumberId)}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: args.to,
        type: 'text',
        text: { preview_url: false, body: args.text },
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        timeout: 15_000,
      },
    );
    return { waMessageId: data.messages?.[0]?.id ?? null };
  }

  async sendTemplate(account: ProviderAccount, args: SendTemplateArgs): Promise<SendResult> {
    if (!account.phoneNumberId) throw new ForbiddenException('phoneNumberId required');
    const token = this.tokenFor(account);
    const components = args.variables?.length
      ? [
          {
            type: 'body',
            parameters: args.variables.map((v) => ({ type: 'text', text: v })),
          },
        ]
      : undefined;
    const { data } = await axios.post<{ messages: { id: string }[] }>(
      `${GRAPH_API}/${encodeURIComponent(account.phoneNumberId)}/messages`,
      {
        messaging_product: 'whatsapp',
        to: args.to,
        type: 'template',
        template: {
          name: args.templateName,
          language: { code: args.language },
          ...(components ? { components } : {}),
        },
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        timeout: 15_000,
      },
    );
    return { waMessageId: data.messages?.[0]?.id ?? null };
  }

  // ── Webhook ───────────────────────────────────────────────────

  /**
   * Meta's GET handshake for webhook verification.
   * Caller must respond with the hub.challenge plain string when valid.
   */
  handleVerificationGet(query: Record<string, string | undefined>): string | null {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    if (mode === 'subscribe' && token && challenge && token === env.META_WEBHOOK_VERIFY_TOKEN) {
      return challenge;
    }
    return null;
  }

  /**
   * Verify X-Hub-Signature-256: HMAC-SHA256 of raw body using the platform app secret.
   */
  verifyWebhook(args: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
  }): boolean {
    if (!env.META_APP_SECRET) {
      this.logger.warn('META_APP_SECRET not set; rejecting Cloud API webhooks');
      return false;
    }
    const sigHeader = (args.headers['x-hub-signature-256'] ?? args.headers['X-Hub-Signature-256']) as string | undefined;
    if (!sigHeader) return false;
    const provided = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : sigHeader;
    const expected = createHmac('sha256', env.META_APP_SECRET)
      .update(args.rawBody, 'utf8')
      .digest('hex');
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  }

  parseWebhook(body: unknown): ParsedWebhookEvents {
    const out: ParsedWebhookEvents = { messages: [], statuses: [] };
    const root = body as {
      entry?: { changes?: { field?: string; value?: any }[] }[];
    };
    for (const entry of root.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages' && change.field !== 'message_template_status_update' &&
            change.field !== 'phone_number_quality_update') continue;

        const v = change.value ?? {};

        if (change.field === 'phone_number_quality_update' && v.display_phone_number) {
          out.qualityUpdate = {
            qualityRating: v.event ?? v.current_limit, // Meta payload variant
            messagingTier: v.current_limit,
          };
          continue;
        }

        const phoneNumberId = v.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Inbound messages
        for (const m of (v.messages ?? []) as any[]) {
          const { type, content, mediaType } = extractCloudContent(m);
          out.messages.push({
            waMessageId: m.id,
            fromPhone: String(m.from ?? '').replace(/\D/g, ''),
            toAccountIdentifier: phoneNumberId,
            pushName: v.contacts?.[0]?.profile?.name ?? null,
            type,
            content,
            mediaUrl: null,
            mediaType,
            timestamp: m.timestamp ? Number(m.timestamp) : undefined,
          });
        }
        // Delivery / read statuses
        for (const s of (v.statuses ?? []) as any[]) {
          if (s.id && s.status) out.statuses.push({ waMessageId: s.id, status: s.status });
        }
      }
    }
    return out;
  }

  // ── helpers ───────────────────────────────────────────────────

  private tokenFor(account: ProviderAccount): string {
    if (env.META_SYSTEM_USER_TOKEN) return env.META_SYSTEM_USER_TOKEN;
    if (!account.accessTokenEnc) {
      throw new ForbiddenException('No Meta access token configured for account');
    }
    const decoded = decryptJson<MetaToken>(account.accessTokenEnc);
    return decoded.access_token;
  }
}

function extractCloudContent(m: any): { type: MessageType; content: string | null; mediaType: string | null } {
  switch (m.type) {
    case 'text': return { type: 'TEXT', content: m.text?.body ?? '', mediaType: null };
    case 'image': return { type: 'IMAGE', content: m.image?.caption ?? null, mediaType: m.image?.mime_type ?? 'image' };
    case 'video': return { type: 'VIDEO', content: m.video?.caption ?? null, mediaType: m.video?.mime_type ?? 'video' };
    case 'audio': return {
      type: m.audio?.voice ? 'VOICE_NOTE' : 'AUDIO',
      content: null,
      mediaType: m.audio?.mime_type ?? 'audio',
    };
    case 'document': return { type: 'DOCUMENT', content: m.document?.caption ?? null, mediaType: m.document?.mime_type ?? 'document' };
    case 'sticker': return { type: 'STICKER', content: null, mediaType: 'sticker' };
    case 'location': return { type: 'LOCATION', content: null, mediaType: 'location' };
    case 'button': return { type: 'TEXT', content: m.button?.text ?? '', mediaType: null };
    case 'interactive': {
      const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return { type: 'TEXT', content: reply?.title ?? reply?.id ?? '', mediaType: null };
    }
    default: return { type: 'TEXT', content: '', mediaType: null };
  }
}
