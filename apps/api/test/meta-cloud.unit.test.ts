import { describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';

// Mirror MetaCloudProvider.verifyWebhook + handleVerificationGet logic so we
// can unit-test it without bringing in the whole NestJS module graph.

const APP_SECRET = 'test-meta-app-secret';
const VERIFY_TOKEN = 'verify-me';

function verifySig(rawBody: string, headers: Record<string, string | undefined>): boolean {
  const sigHeader = headers['x-hub-signature-256'] ?? headers['X-Hub-Signature-256'];
  if (!sigHeader) return false;
  const provided = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : sigHeader;
  const expected = createHmac('sha256', APP_SECRET).update(rawBody, 'utf8').digest('hex');
  if (provided.length !== expected.length) return false;
  // timingSafeEqual on equal-length buffers
  return Buffer.compare(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex')) === 0;
}

function handleVerify(query: Record<string, string | undefined>): string | null {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token && challenge && token === VERIFY_TOKEN) return challenge;
  return null;
}

describe('Meta Cloud webhook', () => {
  it('accepts valid X-Hub-Signature-256', () => {
    const body = '{"object":"whatsapp_business_account","entry":[]}';
    const sig = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
    expect(verifySig(body, { 'x-hub-signature-256': sig })).toBe(true);
  });

  it('rejects missing signature header', () => {
    expect(verifySig('{}', {})).toBe(false);
  });

  it('rejects tampered body', () => {
    const original = '{"a":1}';
    const sig = 'sha256=' + createHmac('sha256', APP_SECRET).update(original).digest('hex');
    expect(verifySig('{"a":2}', { 'x-hub-signature-256': sig })).toBe(false);
  });

  it('rejects wrong secret', () => {
    const body = '{}';
    const sig = 'sha256=' + createHmac('sha256', 'wrong-secret').update(body).digest('hex');
    expect(verifySig(body, { 'x-hub-signature-256': sig })).toBe(false);
  });

  it('handshake echoes hub.challenge when verify token matches', () => {
    const r = handleVerify({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': 'abc123',
    });
    expect(r).toBe('abc123');
  });

  it('handshake rejects wrong verify token', () => {
    expect(
      handleVerify({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'bad',
        'hub.challenge': 'abc123',
      }),
    ).toBeNull();
  });

  it('handshake rejects non-subscribe mode', () => {
    expect(
      handleVerify({
        'hub.mode': 'unsubscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'abc123',
      }),
    ).toBeNull();
  });
});

describe('Meta Cloud message extraction', () => {
  type MessageType = string;
  function extract(m: any): { type: MessageType; content: string | null; mediaType: string | null } {
    switch (m.type) {
      case 'text': return { type: 'TEXT', content: m.text?.body ?? '', mediaType: null };
      case 'image': return { type: 'IMAGE', content: m.image?.caption ?? null, mediaType: m.image?.mime_type ?? 'image' };
      case 'audio': return {
        type: m.audio?.voice ? 'VOICE_NOTE' : 'AUDIO',
        content: null,
        mediaType: m.audio?.mime_type ?? 'audio',
      };
      case 'interactive': {
        const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
        return { type: 'TEXT', content: reply?.title ?? reply?.id ?? '', mediaType: null };
      }
      default: return { type: 'TEXT', content: '', mediaType: null };
    }
  }

  it('extracts plain text', () => {
    const r = extract({ type: 'text', text: { body: 'Hi' } });
    expect(r).toEqual({ type: 'TEXT', content: 'Hi', mediaType: null });
  });

  it('distinguishes voice note from audio via voice flag', () => {
    expect(extract({ type: 'audio', audio: { voice: true, mime_type: 'audio/ogg' } }).type).toBe('VOICE_NOTE');
    expect(extract({ type: 'audio', audio: { mime_type: 'audio/mp4' } }).type).toBe('AUDIO');
  });

  it('extracts interactive button reply', () => {
    const r = extract({
      type: 'interactive',
      interactive: { button_reply: { id: 'b1', title: 'Yes' } },
    });
    expect(r).toEqual({ type: 'TEXT', content: 'Yes', mediaType: null });
  });

  it('falls back gracefully on unknown types', () => {
    const r = extract({ type: 'mystery' });
    expect(r.type).toBe('TEXT');
  });
});
