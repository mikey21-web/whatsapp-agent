import { describe, expect, it } from 'vitest';

/**
 * Meta requires template names to match `^[a-z0-9_]{1,512}$`. Our UI
 * normalizes user input — verify that contract.
 */
function normalizeTemplateName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}
function isValidTemplateName(s: string): boolean {
  return /^[a-z0-9_]{1,512}$/.test(s);
}

describe('Meta template name normalization', () => {
  it('lowercases input', () => {
    expect(normalizeTemplateName('OrderConfirmed')).toBe('orderconfirmed');
  });

  it('replaces spaces and punctuation with underscores', () => {
    expect(normalizeTemplateName('Order Confirmed!')).toBe('order_confirmed_');
    expect(normalizeTemplateName('hi-there')).toBe('hi_there');
  });

  it('preserves digits and underscores', () => {
    expect(normalizeTemplateName('abc_123')).toBe('abc_123');
  });

  it('produces valid name from clean input', () => {
    expect(isValidTemplateName(normalizeTemplateName('order_v2'))).toBe(true);
  });

  it('rejects empty or unicode-only input', () => {
    expect(isValidTemplateName('')).toBe(false);
    expect(isValidTemplateName('     ')).toBe(false);
    expect(isValidTemplateName('మేఘ')).toBe(false);
  });

  it('rejects names with capital letters', () => {
    expect(isValidTemplateName('OrderConfirmed')).toBe(false);
  });
});
