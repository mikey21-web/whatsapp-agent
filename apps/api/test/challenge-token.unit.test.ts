import { describe, expect, it } from 'vitest';

type SubjectType = 'SUPER_ADMIN' | 'AGENCY' | 'CLIENT' | 'TEAM_MEMBER';

function makeChallenge(type: SubjectType, id: string): string {
  return Buffer.from(JSON.stringify({ t: type, i: id, e: Date.now() + 10 * 60_000 })).toString(
    'base64url',
  );
}

function decodeChallenge(c: string): { type: SubjectType; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(c, 'base64url').toString()) as {
      t: SubjectType;
      i: string;
      e: number;
    };
    if (parsed.e < Date.now()) return null;
    return { type: parsed.t, id: parsed.i };
  } catch {
    return null;
  }
}

describe('MFA challenge encoding', () => {
  it('round-trips a fresh challenge', () => {
    const c = makeChallenge('AGENCY', 'ag_123');
    const decoded = decodeChallenge(c);
    expect(decoded).toEqual({ type: 'AGENCY', id: 'ag_123' });
  });

  it('rejects expired challenge', () => {
    const expired = Buffer.from(JSON.stringify({ t: 'CLIENT', i: 'c1', e: Date.now() - 1000 })).toString('base64url');
    expect(decodeChallenge(expired)).toBeNull();
  });

  it('rejects invalid base64', () => {
    expect(decodeChallenge('not-valid-base64@@@')).toBeNull();
  });

  it('rejects garbage JSON', () => {
    const bad = Buffer.from('not json').toString('base64url');
    expect(decodeChallenge(bad)).toBeNull();
  });
});
