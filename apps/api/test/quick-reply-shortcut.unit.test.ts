import { describe, expect, it } from 'vitest';

function normalizeShortcut(s: string): string {
  return s.trim().toLowerCase().replace(/^\/+/, '');
}

describe('quick-reply shortcut normalization', () => {
  it('strips leading slash', () => {
    expect(normalizeShortcut('/hours')).toBe('hours');
  });
  it('strips multiple leading slashes', () => {
    expect(normalizeShortcut('//hours')).toBe('hours');
  });
  it('lowercases', () => {
    expect(normalizeShortcut('HOURS')).toBe('hours');
  });
  it('trims whitespace', () => {
    expect(normalizeShortcut('  hours  ')).toBe('hours');
  });
  it('handles combinations: leading slashes are stripped, internal whitespace preserved', () => {
    expect(normalizeShortcut('  /  hello  ')).toBe('  hello');
  });
});
