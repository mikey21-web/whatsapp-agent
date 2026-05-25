import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson } from '../src/integrations/crypto.util';

describe('AES-256-GCM credential encryption', () => {
  it('round-trips a JSON object', () => {
    const payload = { access_token: 'abc123', refresh_token: 'rt-xyz', expires_at: 9999 };
    const cipher = encryptJson(payload);
    expect(typeof cipher).toBe('string');
    expect(cipher.split('.').length).toBe(3); // iv.tag.data
    expect(cipher).not.toContain('abc123');
    expect(decryptJson<typeof payload>(cipher)).toEqual(payload);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const a = encryptJson({ token: 't' });
    const b = encryptJson({ token: 't' });
    expect(a).not.toBe(b);
    expect(decryptJson(a)).toEqual(decryptJson(b));
  });

  it('rejects tampered ciphertext (auth tag fails)', () => {
    const cipher = encryptJson({ secret: 'value' });
    const [iv, tag, data] = cipher.split('.');
    // Flip a byte in the data segment.
    const flipped = data!.charAt(0) === 'a' ? 'b' + data!.slice(1) : 'a' + data!.slice(1);
    const tampered = `${iv}.${tag}.${flipped}`;
    expect(() => decryptJson(tampered)).toThrow();
  });

  it('rejects malformed input', () => {
    expect(() => decryptJson('not.valid')).toThrow();
    expect(() => decryptJson('garbage')).toThrow();
  });

  it('handles arbitrary JSON shapes', () => {
    const cases = [
      { simple: 'string' },
      { nested: { a: { b: { c: 1 } } } },
      { array: [1, 2, 3] },
      { unicode: 'తెలుగు 🇮🇳' },
      {},
    ];
    for (const c of cases) {
      expect(decryptJson(encryptJson(c))).toEqual(c);
    }
  });
});
