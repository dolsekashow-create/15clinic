import { z } from 'zod';
import { baseEntityShape, minorAmountSchema } from './base.js';

/**
 * Double-entry accounting core.
 *
 * Why double entry rather than a simple income/expense table: it is the only
 * model that survives contact with real requirements (taxes, refunds, partial
 * payments, inter-branch transfers, auditors) without a rewrite. The chart of
 * accounts, tax rates and posting rules are all DATA, so the client's specific
 * policies can be configured after the requirements meeting instead of coded now.
 *
 * Invariants enforced in AccountingService (not in the UI):
 *  1. Every posted journal entry balances: sum(debit) === sum(credit).
 *  2. A posted entry is immutable. Corrections happen through a reversing entry.
 *  3. Nothing may post into a closed fiscal period.
 *  4. All amounts are integers in minor units. No floats anywhere.
 */

export const accountType = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);
export type AccountType = z.infer<typeof accountType>;

/** Which side increases the balance. Derived from type but stored for clarity in reports. */
export const NORMAL_BALANCE: Record<AccountType, 'debit' | 'credit'> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
};

export const accountSchema = z.object({
  ...baseEntityShape,
  /** Chart of accounts is company-wide; the branch appears on the journal line instead. */
  branchId: z.null(),
  code: z.string().min(1),
  name: z.string().min(2),
  nameEn: z.string().optional(),
  type: accountType,
  normalBalance: z.enum(['debit', 'credit']),
  parentId: z.string().nullable().default(null),
  /** Group accounts are headers only — postings are rejected on them. */
  isGroup: z.boolean().default(false),
  /** Ancestor ids, root first. Makes subtree reports a single query. */
  path: z.array(z.string()).default([]),
  level: z.number().int().nonnegative().default(0),
  currency: z.string().length(3).default('EGP'),
  isSystem: z.boolean().default(false),
  status: z.enum(['active', 'archived']).default('active'),
  description: z.string().nullable().default(null),
});
export type Account = z.infer<typeof accountSchema>;

export const fiscalPeriodSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  /** YYYY-MM — monthly periods by default. DECISION_PENDING if the client uses another calendar. */
  code: z.string().regex(/^\d{4}-\d{2}$/),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['open', 'closed']).default('open'),
  closedAt: z.string().nullable().default(null),
  closedBy: z.string().nullable().default(null),
});
export type FiscalPeriod = z.infer<typeof fiscalPeriodSchema>;

export const taxRateSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  name: z.string(),
  /** Basis points: 1400 === 14.00%. Integer, so no float drift. */
  rateBps: z.number().int().nonnegative(),
  isInclusive: z.boolean().default(false),
  /** Liability account the collected tax is credited to. */
  accountId: z.string().nullable().default(null),
  status: z.enum(['active', 'inactive']).default('active'),
  // BUSINESS_RULE_PENDING: actual Egyptian tax treatment for medical services
  // (exemptions, withholding) is not confirmed. No rate is seeded by default.
});
export type TaxRate = z.infer<typeof taxRateSchema>;

// ── Journal ──────────────────────────────────────────────────

export const journalLineSchema = z.object({
  accountId: z.string().min(1),
  /** Cost centre. Every line carries its branch so per-branch P&L is a plain query. */
  branchId: z.string().nullable().default(null),
  debitMinor: minorAmountSchema.nonnegative().default(0),
  creditMinor: minorAmountSchema.nonnegative().default(0),
  description: z.string().nullable().default(null),
  customerId: z.string().nullable().default(null),
  doctorId: z.string().nullable().default(null),
})
  .refine((l) => !(l.debitMinor > 0 && l.creditMinor > 0), {
    message: 'السطر لا يمكن أن يكون مدينًا ودائنًا في نفس الوقت',
  })
  .refine((l) => l.debitMinor > 0 || l.creditMinor > 0, {
    message: 'يجب إدخال مبلغ مدين أو دائن',
  });
export type JournalLine = z.infer<typeof journalLineSchema>;

export const journalSourceType = z.enum([
  'manual', 'invoice', 'payment', 'refund', 'void', 'reversal', 'adjustment', 'closing',
]);

export const journalEntrySchema = z.object({
  ...baseEntityShape,
  /** Header branch; individual lines may target different branches. */
  branchId: z.string().nullable(),
  entryNumber: z.string(),
  entryDate: z.string(),
  periodCode: z.string(),
  description: z.string(),
  sourceType: journalSourceType.default('manual'),
  sourceId: z.string().nullable().default(null),
  /** Lines are embedded: they are always read with the header and never exceed a few dozen. */
  lines: z.array(journalLineSchema).min(2),
  totalDebitMinor: minorAmountSchema.nonnegative(),
  totalCreditMinor: minorAmountSchema.nonnegative(),
  currency: z.string().length(3).default('EGP'),
  status: z.enum(['draft', 'posted', 'reversed']).default('draft'),
  postedAt: z.string().nullable().default(null),
  postedBy: z.string().nullable().default(null),
  /** Set on the reversing entry, pointing at the original. */
  reversalOfEntryId: z.string().nullable().default(null),
  reversedByEntryId: z.string().nullable().default(null),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

// ── Invoices ─────────────────────────────────────────────────

export const invoiceItemSchema = z.object({
  serviceId: z.string().nullable().default(null),
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPriceMinor: minorAmountSchema.nonnegative(),
  discountMinor: minorAmountSchema.nonnegative().default(0),
  taxRateId: z.string().nullable().default(null),
  taxMinor: minorAmountSchema.nonnegative().default(0),
  lineTotalMinor: minorAmountSchema.nonnegative(),
  revenueAccountId: z.string().nullable().default(null),
  doctorId: z.string().nullable().default(null),
});
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const invoiceStatus = z.enum(['draft', 'issued', 'partially_paid', 'paid', 'void']);

export const invoiceSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  invoiceNumber: z.string(),
  customerId: z.string(),
  appointmentId: z.string().nullable().default(null),
  visitId: z.string().nullable().default(null),
  issueDate: z.string(),
  dueDate: z.string().nullable().default(null),
  periodCode: z.string(),
  currency: z.string().length(3).default('EGP'),
  items: z.array(invoiceItemSchema).min(1),
  subtotalMinor: minorAmountSchema.nonnegative(),
  discountMinor: minorAmountSchema.nonnegative().default(0),
  taxMinor: minorAmountSchema.nonnegative().default(0),
  totalMinor: minorAmountSchema.nonnegative(),
  paidMinor: minorAmountSchema.nonnegative().default(0),
  balanceMinor: minorAmountSchema.default(0),
  status: invoiceStatus.default('draft'),
  journalEntryId: z.string().nullable().default(null),
  voidedAt: z.string().nullable().default(null),
  voidReason: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type Invoice = z.infer<typeof invoiceSchema>;

// ── Payments & cash sessions ─────────────────────────────────

export const paymentMethod = z.enum(['cash', 'card', 'bank_transfer', 'wallet', 'insurance', 'other']);

export const paymentSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  paymentNumber: z.string(),
  /** `in` = customer paid us, `out` = refund. */
  direction: z.enum(['in', 'out']).default('in'),
  invoiceId: z.string().nullable().default(null),
  customerId: z.string(),
  method: paymentMethod,
  amountMinor: minorAmountSchema.positive(),
  currency: z.string().length(3).default('EGP'),
  paidAt: z.string(),
  periodCode: z.string(),
  cashSessionId: z.string().nullable().default(null),
  /** Cash/bank account the money landed in. */
  accountId: z.string().nullable().default(null),
  reference: z.string().nullable().default(null),
  journalEntryId: z.string().nullable().default(null),
  status: z.enum(['completed', 'voided']).default('completed'),
  notes: z.string().nullable().default(null),
});
export type Payment = z.infer<typeof paymentSchema>;

/** Reception shift. Closing it produces the expected-vs-counted cash variance. */
export const cashSessionSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  sessionNumber: z.string(),
  openedBy: z.string(),
  openedAt: z.string(),
  openingFloatMinor: minorAmountSchema.nonnegative().default(0),
  closedBy: z.string().nullable().default(null),
  closedAt: z.string().nullable().default(null),
  expectedCashMinor: minorAmountSchema.nullable().default(null),
  countedCashMinor: minorAmountSchema.nullable().default(null),
  varianceMinor: minorAmountSchema.nullable().default(null),
  status: z.enum(['open', 'closed']).default('open'),
  notes: z.string().nullable().default(null),
});
export type CashSession = z.infer<typeof cashSessionSchema>;
