import { Injectable, Logger } from '@nestjs/common';
import { EvolutionClient } from './evolution.client';
import { env } from '../config/env';
import type {
  ConnectionUpdate,
  InboundMessage,
  ParsedWebhookEvents,
  ProviderAccount,
  SendResult,
  SendTextArgs,
  WhatsappProviderImpl,
} from './provider.types';
import type { MessageType } from '@diyaa/db';

@Injectable()
export class EvolutionProvider implements WhatsappProviderImpl {
  readonly kind = 'EVOLUTION' as const;
  private readonly logger = new Logger('Provider:Evolution');

  constructor(private readonly client: EvolutionClient) {}

  async provision(account: ProviderAccount): Promise<void> {
    if (!account.webhookUrl) return;
    await this.client.createInstance(account.instanceName, account.webhookUrl);
  }

  getQR(account: ProviderAccount) {
    return this.client.getInstanceQR(account.instanceName);
  }

  async getStatus(account: ProviderAccount) {
    const r = await this.client.getInstanceStatus(account.instanceName);
    return { status: r.instance.status };
  }

  async sendText(account: ProviderAccount, args: SendTextArgs): Promise<SendResult> {
    const r = await this.client.sendText(
      account.instanceName,
      `${args.to}@s.whatsapp.net`,
      args.text,
    );
    return { waMessageId: r.key?.id ?? null };
  }

  async teardown(account: ProviderAccount): Promise<void> {
    await this.client.deleteInstance(account.instanceName).catch(() => undefined);
  }

  verifyWebhook(args: {
    headers: Record<string, string | string[] | undefined>;
  }): boolean {
    const provided = (args.headers['apikey'] ?? args.headers['authorization']) as string | undefined;
    const token = provided?.toString().replace(/^Bearer /, '');
    return !!token && token === env.EVOLUTION_API_KEY;
  }

  parseWebhook(body: unknown): ParsedWebhookEvents {
    const env = body as { event?: string; instance?: string; data?: any; state?: string };
    const event = String(env.event ?? '').toLowerCase();
    const out: ParsedWebhookEvents = { messages: [], statuses: [] };

    if (event.includes('connection.update') && env.instance) {
      const update: ConnectionUpdate = {
        toAccountIdentifier: env.instance,
        isConnected: (env.state ?? '').toLowerCase() === 'open',
      };
      out.connection = update;
      return out;
    }

    if (event.includes('messages.upsert') && env.data?.key) {
      if (env.data.key.fromMe) return out;
      const remoteJid = env.data.key.remoteJid ?? '';
      const phone = remoteJid.split('@')[0]?.replace(/\D/g, '') ?? '';
      if (!phone) return out;
      const { type, content, mediaType } = extractContent(env.data);
      out.messages.push({
        waMessageId: env.data.key.id ?? '',
        fromPhone: phone,
        toAccountIdentifier: env.instance ?? '',
        pushName: env.data.pushName ?? null,
        type,
        content,
        mediaUrl: null,
        mediaType,
        timestamp: env.data.messageTimestamp,
      });
    }
    return out;
  }
}

function extractContent(data: any): { type: MessageType; content: string | null; mediaType: string | null } {
  const m = data.message ?? {};
  if (m.conversation && typeof m.conversation === 'string') {
    return { type: 'TEXT', content: m.conversation, mediaType: null };
  }
  const ext = m.extendedTextMessage?.text;
  if (typeof ext === 'string') return { type: 'TEXT', content: ext, mediaType: null };
  if (m.imageMessage) return { type: 'IMAGE', content: null, mediaType: 'image' };
  if (m.videoMessage) return { type: 'VIDEO', content: null, mediaType: 'video' };
  if (m.audioMessage) {
    const isVoice = m.audioMessage.ptt === true ? 'VOICE_NOTE' : 'AUDIO';
    return { type: isVoice as MessageType, content: null, mediaType: 'audio' };
  }
  if (m.documentMessage) return { type: 'DOCUMENT', content: null, mediaType: 'document' };
  if (m.stickerMessage) return { type: 'STICKER', content: null, mediaType: 'sticker' };
  if (m.locationMessage) return { type: 'LOCATION', content: null, mediaType: 'location' };
  return { type: 'TEXT', content: '', mediaType: null };
}
