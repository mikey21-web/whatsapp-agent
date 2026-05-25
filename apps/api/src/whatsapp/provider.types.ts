import type { WhatsappAccount, MessageType } from '@diyaa/db';

export interface InboundMessage {
  waMessageId: string;
  fromPhone: string;
  toAccountIdentifier: string; // instanceName for Evolution, phoneNumberId for Meta
  pushName?: string | null;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  /// Unix seconds timestamp of message at WhatsApp.
  timestamp?: number;
}

export interface ConnectionUpdate {
  toAccountIdentifier: string;
  isConnected: boolean;
  qualityRating?: string;
  messagingTier?: string;
}

export interface ParsedWebhookEvents {
  messages: InboundMessage[];
  statuses: { waMessageId: string; status: string }[];
  connection?: ConnectionUpdate;
  qualityUpdate?: { qualityRating?: string; messagingTier?: string };
}

export interface SendTextArgs {
  to: string;
  text: string;
}

export interface SendTemplateArgs {
  to: string;
  templateName: string;
  language: string;
  /// Variable bag matching the template's body parameters in order.
  variables?: string[];
}

export interface SendResult {
  waMessageId: string | null;
}

export interface ProviderAccount extends Pick<
  WhatsappAccount,
  | 'id'
  | 'instanceName'
  | 'phoneNumber'
  | 'phoneNumberId'
  | 'wabaId'
  | 'accessTokenEnc'
  | 'webhookUrl'
> {}

/**
 * Common surface every WhatsApp gateway implementation must provide.
 * Anything provider-specific (QR codes, Meta tier rating, etc.) is exposed
 * via dedicated optional methods so callers can branch on `account.provider`.
 */
export interface WhatsappProviderImpl {
  readonly kind: 'EVOLUTION' | 'META_CLOUD';

  /** Optional provisioning step (Evolution creates the bailey instance, Meta is no-op). */
  provision?(account: ProviderAccount): Promise<void>;

  /** QR fetch — only Evolution. Meta returns null. */
  getQR(account: ProviderAccount): Promise<{ base64?: string; code?: string } | null>;

  /** Status check — Evolution returns connection state, Meta returns phone metadata. */
  getStatus(account: ProviderAccount): Promise<{ status: string; qualityRating?: string; messagingTier?: string }>;

  sendText(account: ProviderAccount, args: SendTextArgs): Promise<SendResult>;
  sendTemplate?(account: ProviderAccount, args: SendTemplateArgs): Promise<SendResult>;

  /** Tear-down for delete (Evolution: delete instance; Meta: no-op). */
  teardown?(account: ProviderAccount): Promise<void>;

  /**
   * Webhook signature verification. Provider-specific (apikey header for Evolution,
   * X-Hub-Signature-256 HMAC of raw body for Meta).
   */
  verifyWebhook(args: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
    queryParams?: Record<string, string | undefined>;
  }): boolean;

  /** Optional GET handshake response (Meta hub.challenge). Returns string body or null. */
  handleVerificationGet?(query: Record<string, string | undefined>): string | null;

  parseWebhook(body: unknown): ParsedWebhookEvents;
}
