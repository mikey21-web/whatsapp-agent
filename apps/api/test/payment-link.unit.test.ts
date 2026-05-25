import { describe, expect, it } from 'vitest';

function renderPaymentMessage(args: {
  contactName: string | null;
  amountInr: number;
  description: string;
  shortUrl: string;
}): string {
  const greet = args.contactName ? `Hi ${args.contactName},` : 'Hi,';
  return [
    greet,
    '',
    `${args.description}`,
    '',
    `Amount: ₹${args.amountInr.toLocaleString('en-IN')}`,
    `Pay securely: ${args.shortUrl}`,
  ].join('\n');
}

describe('payment-link message rendering', () => {
  it('uses the contact name when present', () => {
    const r = renderPaymentMessage({
      contactName: 'Asha',
      amountInr: 999,
      description: 'Order #1234',
      shortUrl: 'https://rzp.io/abc',
    });
    expect(r).toContain('Hi Asha,');
    expect(r).toContain('Order #1234');
    expect(r).toContain('Pay securely: https://rzp.io/abc');
  });

  it('falls back to "Hi," when no name', () => {
    const r = renderPaymentMessage({
      contactName: null,
      amountInr: 100,
      description: 'Test',
      shortUrl: 'https://rzp.io/x',
    });
    expect(r.startsWith('Hi,')).toBe(true);
  });

  it('formats amount with Indian grouping', () => {
    const r = renderPaymentMessage({
      contactName: null,
      amountInr: 100_000,
      description: 'Big purchase',
      shortUrl: 'https://rzp.io/x',
    });
    // en-IN formatting puts the lakh separator: 1,00,000
    expect(r).toContain('₹1,00,000');
  });

  it('handles minimum amount of ₹1', () => {
    const r = renderPaymentMessage({
      contactName: null,
      amountInr: 1,
      description: 'Tip',
      shortUrl: 'https://rzp.io/x',
    });
    expect(r).toContain('₹1');
  });
});

describe('payment-link minimum-amount validation', () => {
  function paiseFromInr(inr: number): number {
    return Math.round(inr * 100);
  }
  function isValidAmount(inr: number): boolean {
    const paise = paiseFromInr(inr);
    return paise >= 100;
  }

  it('rejects amounts below ₹1', () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(0.5)).toBe(false);
    expect(isValidAmount(0.99)).toBe(false);
  });

  it('accepts ₹1 and above (paise rounding includes 0.999 which rounds up to 100p)', () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(0.999)).toBe(true);  // rounds to 100 paise = ₹1
    expect(isValidAmount(50)).toBe(true);
    expect(isValidAmount(99_999)).toBe(true);
  });

  it('rounds half-up at the paise boundary', () => {
    expect(paiseFromInr(0.999)).toBe(100);
    expect(paiseFromInr(0.994)).toBe(99);
  });
});
