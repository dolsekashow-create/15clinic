import { describe, expect, it } from 'vitest';
import { computeInvoiceTotals, taxFor } from '../src/accounting/money.js';

describe('money', () => {
  it('keeps everything in integers', () => {
    const t = computeInvoiceTotals([
      { description: 'كشف', quantity: 1, unitPriceMinor: 30000, taxRateBps: 1400 },
      { description: 'أشعة', quantity: 2, unitPriceMinor: 12550, discountMinor: 1000, taxRateBps: 1400 },
    ]);
    expect(Number.isInteger(t.totalMinor)).toBe(true);
    expect(Number.isInteger(t.taxMinor)).toBe(true);
  });

  it('produces a balanced invoice posting', () => {
    const t = computeInvoiceTotals([
      { description: 'كشف', quantity: 1, unitPriceMinor: 30000, taxRateBps: 1400 },
      { description: 'أشعة', quantity: 2, unitPriceMinor: 12550, discountMinor: 1000, taxRateBps: 1400 },
      { description: 'خدمة معفاة', quantity: 1, unitPriceMinor: 5000 },
    ]);
    const debits = t.totalMinor + t.discountMinor;
    const credits =
      t.items.reduce((s, i) => s + (i.lineTotalMinor - i.taxMinor + i.discountMinor), 0) + t.taxMinor;
    expect(debits).toBe(credits);
  });

  it('handles tax-inclusive prices', () => {
    expect(taxFor(11400, 1400, true)).toBe(1400);
    expect(taxFor(10000, 1400, false)).toBe(1400);
  });

  it('rejects a discount larger than the line', () => {
    expect(() =>
      computeInvoiceTotals([{ description: 'x', quantity: 1, unitPriceMinor: 1000, discountMinor: 2000 }]),
    ).toThrow();
  });
});
