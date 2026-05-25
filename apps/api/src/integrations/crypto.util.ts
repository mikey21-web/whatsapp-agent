import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../config/env';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;

function key(): Buffer {
  // Allow either 64-hex or any string ≥32 chars; hash to 32 bytes for safety.
  return createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

export function encryptJson(payload: unknown): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`;
}

export function decryptJson<T = unknown>(blob: string): T {
  const parts = blob.split('.');
  if (parts.length !== 3) throw new Error('bad ciphertext');
  const iv = Buffer.from(parts[0]!, 'base64url');
  const tag = Buffer.from(parts[1]!, 'base64url');
  const data = Buffer.from(parts[2]!, 'base64url');
  const decipher = createDecipheriv(ALG, key(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(plain) as T;
}
