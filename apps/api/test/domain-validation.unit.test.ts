import { describe, expect, it } from 'vitest';

function isValidHostname(s: string): boolean {
  return /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/.test(s);
}

describe('custom domain hostname validation', () => {
  it.each([
    'app.example.com',
    'subdomain.agency.in',
    'multi.level.sub.example.co.uk',
    'a-b.example.com',
    'hyphen-allowed.io',
  ])('accepts valid: %s', (h) => {
    expect(isValidHostname(h)).toBe(true);
  });

  it.each([
    '-bad.example.com',
    'no-tld',
    'has spaces.com',
    'UPPERCASE.com',
    '',
    '.',
    '.com',
    'a..b.com',
    'has_underscore.com',
  ])('rejects invalid: %s', (h) => {
    expect(isValidHostname(h)).toBe(false);
  });

  it('rejects hostnames longer than 253 chars', () => {
    const long = 'a.'.repeat(127) + 'com';
    expect(isValidHostname(long)).toBe(false);
  });
});
