import type { InvoiceItem } from '@/server/core';

/**
 * All money maths lives here, on integers.
 *
 * Floats are banned in the ledger: 0.1 + 0.2 !== 0.3, and an accountant will
 * eventually notice. Amounts are minor units (piasters) and tax rates are
 * basis points, so every intermediate value stays an integer.
 */

/** Banker-safe rounding of an integer division. */
export function divideRound(numerator: number, denominator: number): number {
  return Math.round(numerator / denominator);
}

export function taxFor(baseMinor: number, rateBps: number, isInclusive: boolean): number {
  if (rateBps <= 0) return 0;
  return isInclusive
    ? baseMinor - divideRound(baseMinor * 10_000, 10_000 + rateBps)
    : divideRound(baseMinor * rateBps, 10_000);
}

export interface ItemInput {
  serviceId?: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateId?: string | null;
  taxRateBps?: number;
  taxInclusive?: boolean;
  revenueAccountId?: string | null;
  doctorId?: string | null;
}

export interface InvoiceTotals {
  items: InvoiceItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function computeInvoiceTotals(inputs: ItemInput[]): InvoiceTotals {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;

  const items: InvoiceItem[] = inputs.map((input) => {
    const gross = Math.round(input.unitPriceMinor * input.quantity);
    const lineDiscount = input.discountMinor ?? 0;
    if (lineDiscount > gross) {
      throw new Error('الخصم أكبر من قيمة السطر');
    }
    const net = gross - lineDiscount;
    const lineTax = taxFor(net, input.taxRateBps ?? 0, input.taxInclusive ?? false);
    const lineTotal = (input.taxInclusive ?? false) ? net : net + lineTax;

    subtotal += gross;
    discount += lineDiscount;
    tax += lineTax;

    return {
      serviceId: input.serviceId ?? null,
      description: input.description,
      quantity: input.quantity,
      unitPriceMinor: input.unitPriceMinor,
      discountMinor: lineDiscount,
      taxRateId: input.taxRateId ?? null,
      taxMinor: lineTax,
      lineTotalMinor: lineTotal,
      revenueAccountId: input.revenueAccountId ?? null,
      doctorId: input.doctorId ?? null,
    };
  });

  return {
    items,
    subtotalMinor: subtotal,
    discountMinor: discount,
    taxMinor: tax,
    totalMinor: items.reduce((sum, i) => sum + i.lineTotalMinor, 0),
  };
}

export function periodCodeFor(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}

export function formatMinor(amount: number, currency = 'EGP'): string {
  return `${(amount / 100).toFixed(2)} ${currency}`;
}
