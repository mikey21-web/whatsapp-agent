import { describe, expect, it } from 'vitest';

type MessageType =
  | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE_NOTE'
  | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'TEMPLATE';

interface ExtractResult {
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
}

function extractContent(data: { message?: Record<string, unknown> }): ExtractResult {
  const m = data.message ?? {};
  if (m.conversation && typeof m.conversation === 'string') {
    return { type: 'TEXT', content: m.conversation, mediaUrl: null, mediaType: null };
  }
  const ext = (m.extendedTextMessage as { text?: string } | undefined)?.text;
  if (typeof ext === 'string') {
    return { type: 'TEXT', content: ext, mediaUrl: null, mediaType: null };
  }
  if (m.imageMessage) return { type: 'IMAGE', content: null, mediaUrl: null, mediaType: 'image' };
  if (m.videoMessage) return { type: 'VIDEO', content: null, mediaUrl: null, mediaType: 'video' };
  if (m.audioMessage) {
    const isVoice = (m.audioMessage as { ptt?: boolean }).ptt === true ? 'VOICE_NOTE' : 'AUDIO';
    return { type: isVoice as MessageType, content: null, mediaUrl: null, mediaType: 'audio' };
  }
  if (m.documentMessage) return { type: 'DOCUMENT', content: null, mediaUrl: null, mediaType: 'document' };
  if (m.stickerMessage) return { type: 'STICKER', content: null, mediaUrl: null, mediaType: 'sticker' };
  if (m.locationMessage) return { type: 'LOCATION', content: null, mediaUrl: null, mediaType: 'location' };
  return { type: 'TEXT', content: '', mediaUrl: null, mediaType: null };
}

describe('Evolution API message extraction', () => {
  it('extracts plain text', () => {
    const r = extractContent({ message: { conversation: 'Hello' } });
    expect(r).toEqual({ type: 'TEXT', content: 'Hello', mediaUrl: null, mediaType: null });
  });

  it('extracts extendedTextMessage', () => {
    const r = extractContent({ message: { extendedTextMessage: { text: 'Reply with quote' } } });
    expect(r.type).toBe('TEXT');
    expect(r.content).toBe('Reply with quote');
  });

  it('detects image', () => {
    const r = extractContent({ message: { imageMessage: { mimetype: 'image/jpeg' } } });
    expect(r.type).toBe('IMAGE');
    expect(r.mediaType).toBe('image');
  });

  it('detects video', () => {
    expect(extractContent({ message: { videoMessage: {} } }).type).toBe('VIDEO');
  });

  it('distinguishes voice note from audio', () => {
    expect(extractContent({ message: { audioMessage: { ptt: true } } }).type).toBe('VOICE_NOTE');
    expect(extractContent({ message: { audioMessage: { ptt: false } } }).type).toBe('AUDIO');
    expect(extractContent({ message: { audioMessage: {} } }).type).toBe('AUDIO');
  });

  it('detects document, sticker, location', () => {
    expect(extractContent({ message: { documentMessage: {} } }).type).toBe('DOCUMENT');
    expect(extractContent({ message: { stickerMessage: {} } }).type).toBe('STICKER');
    expect(extractContent({ message: { locationMessage: {} } }).type).toBe('LOCATION');
  });

  it('falls back to TEXT for unknown payloads', () => {
    const r = extractContent({ message: {} });
    expect(r.type).toBe('TEXT');
    expect(r.content).toBe('');
  });
});
