import {
  AppError, ErrorCode, canAccessBranch,
  type AccessContext, type Invoice, type JournalEntry, type JournalLine, type Payment,
} from '@clinic/core';
import {
  AccountRepository, FiscalPeriodRepository, InvoiceRepository, JournalEntryRepository,
  PaymentRepository, SystemSettingRepository, nextSequence,
} from '@clinic/data';
import { auditService } from '../audit/audit-service.js';
import { ACCOUNT_MAP_SETTING_KEY, type SystemAccountKey } from './chart-of-accounts.js';
import { computeInvoiceTotals, periodCodeFor, type ItemInput } from './money.js';

/**
 * ── Accounting engine ──────────────────────────────────────────────────
 *
 * Invariants enforced here, never in the UI:
 *   1. A posted journal entry balances exactly (debits === credits).
 *   2. Posted entries are immutable; corrections create a reversing entry.
 *   3. Nothing posts into a closed fiscal period.
 *   4. Group (header) accounts cannot be posted to.
 *   5. Every automated posting records its source document, so any number in a
 *      report can be traced back to the invoice or payment that produced it.
 *
 * BUSINESS_RULE_PENDING — awaiting the client:
 *   - tax treatment for medical services (rates, exemptions, withholding)
 *   - doctor commissions / revenue sharing
 *   - insurance company billing and settlement flow
 *   - credit terms and receivable ageing policy
 * None of these are invented. Each hooks in as extra journal lines without any
 * schema change.
 */

export interface JournalLineInput {
  accountId: string;
  branchId?: string | null;
  debitMinor?: number;
  creditMinor?: number;
  description?: string | null;
  customerId?: string | null;
  doctorId?: string | null;
}

export interface PostEntryInput {
  branchId: string | null;
  entryDate: string;
  description: string;
  lines: JournalLineInput[];
  sourceType?: JournalEntry['sourceType'];
  sourceId?: string | null;
  /** Draft entries can be edited; posted ones cannot. */
  post?: boolean;
}

export interface CreateInvoiceInput {
  branchId: string;
  customerId: string;
  appointmentId?: string | null;
  visitId?: string | null;
  issueDate?: string;
  dueDate?: string | null;
  items: ItemInput[];
  notes?: string | null;
  /** Issue and post immediately, or leave as an editable draft. */
  issue?: boolean;
}

export interface RecordPaymentInput {
  branchId: string;
  customerId: string;
  invoiceId?: string | null;
  method: Payment['method'];
  amountMinor: number;
  paidAt?: string;
  cashSessionId?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export class AccountingService {
  private readonly accounts = new AccountRepository();
  private readonly periods = new FiscalPeriodRepository();
  private readonly journal = new JournalEntryRepository();
  private readonly invoices = new InvoiceRepository();
  private readonly payments = new PaymentRepository();
  private readonly settings = new SystemSettingRepository();

  // ── Guards ───────────────────────────────────────────────

  private async assertPeriodOpen(ctx: AccessContext, periodCode: string): Promise<void> {
    const found = await this.periods.list(ctx, {
      filters: [{ field: 'code', op: '==', value: periodCode }],
      limit: 1,
    });
    const period = found.items[0];
    // An unknown period is treated as open: periods are created lazily on first
    // posting, and refusing here would block day one of a new month.
    if (period && period.status === 'closed') {
      throw new AppError(ErrorCode.PERIOD_CLOSED, 409, { periodCode });
    }
  }

  private async assertPostable(ctx: AccessContext, accountIds: string[]): Promise<void> {
    const unique = [...new Set(accountIds)];
    const accounts = await Promise.all(unique.map((id) => this.accounts.requireById(ctx, id)));
    for (const account of accounts) {
      if (account.isGroup) {
        throw AppError.validation({ reason: 'cannot post to a group account', code: account.code });
      }
      if (account.status !== 'active') {
        throw AppError.validation({ reason: 'account is archived', code: account.code });
      }
    }
  }

  /** Resolves a logical account key (e.g. `accounts_receivable`) to a real id. */
  async resolveSystemAccount(ctx: AccessContext, key: SystemAccountKey): Promise<string> {
    const found = await this.settings.list(ctx, {
      filters: [{ field: 'key', op: '==', value: ACCOUNT_MAP_SETTING_KEY }],
      limit: 1,
    });
    const map = (found.items[0]?.value ?? {}) as Record<string, string>;
    const accountId = map[key];
    if (!accountId) {
      throw AppError.validation({
        reason: 'system account not mapped — run the accounting seed or set it in settings',
        key,
      });
    }
    return accountId;
  }

  // ── Journal ──────────────────────────────────────────────

  async createEntry(ctx: AccessContext, input: PostEntryInput): Promise<JournalEntry> {
    if (input.branchId && !canAccessBranch(ctx, input.branchId)) {
      throw AppError.branchForbidden(input.branchId);
    }
    if (input.lines.length < 2) {
      throw AppError.validation({ reason: 'a journal entry needs at least two lines' });
    }

    const lines: JournalLine[] = input.lines.map((l) => ({
      accountId: l.accountId,
      branchId: l.branchId ?? input.branchId ?? null,
      debitMinor: l.debitMinor ?? 0,
      creditMinor: l.creditMinor ?? 0,
      description: l.description ?? null,
      customerId: l.customerId ?? null,
      doctorId: l.doctorId ?? null,
    }));

    for (const line of lines) {
      if (!Number.isInteger(line.debitMinor) || !Number.isInteger(line.creditMinor)) {
        throw AppError.validation({ reason: 'amounts must be integers in minor units' });
      }
      if (line.debitMinor > 0 && line.creditMinor > 0) {
        throw AppError.validation({ reason: 'a line cannot be both debit and credit' });
      }
      if (line.debitMinor === 0 && line.creditMinor === 0) {
        throw AppError.validation({ reason: 'a line must carry an amount' });
      }
    }

    const totalDebit = lines.reduce((s, l) => s + l.debitMinor, 0);
    const totalCredit = lines.reduce((s, l) => s + l.creditMinor, 0);
    if (totalDebit !== totalCredit) {
      throw new AppError(ErrorCode.UNBALANCED_JOURNAL_ENTRY, 422, { totalDebit, totalCredit });
    }

    const periodCode = periodCodeFor(input.entryDate);
    await this.assertPeriodOpen(ctx, periodCode);
    await this.assertPostable(ctx, lines.map((l) => l.accountId));

    const seq = await nextSequence(ctx.organizationId, 'journal_entry', 6);
    const shouldPost = input.post ?? true;
    const now = new Date().toISOString();

    const entry = await this.journal.create(ctx, {
      branchId: input.branchId,
      entryNumber: `JE-${seq.formatted}`,
      entryDate: input.entryDate,
      periodCode,
      description: input.description,
      sourceType: input.sourceType ?? 'manual',
      sourceId: input.sourceId ?? null,
      lines,
      totalDebitMinor: totalDebit,
      totalCreditMinor: totalCredit,
      currency: 'EGP',
      status: shouldPost ? 'posted' : 'draft',
      postedAt: shouldPost ? now : null,
      postedBy: shouldPost ? ctx.userId : null,
      reversalOfEntryId: null,
      reversedByEntryId: null,
    } as never);

    await auditService.record(ctx, {
      action: shouldPost ? 'accounting.journal.post' : 'accounting.journal.create',
      entityType: 'journal_entry',
      entityId: entry.id,
      branchId: input.branchId,
      after: { entryNumber: entry.entryNumber, totalDebit, totalCredit, sourceType: entry.sourceType },
    });

    return entry;
  }

  /**
   * Posted entries are never edited. A correction is a mirrored entry that
   * cancels the original, leaving both visible to an auditor.
   */
  async reverseEntry(ctx: AccessContext, entryId: string, reason: string): Promise<JournalEntry> {
    const original = await this.journal.requireById(ctx, entryId);
    if (original.status !== 'posted') {
      throw AppError.conflict(ErrorCode.CONFLICT, { reason: 'only posted entries can be reversed' });
    }
    if (original.reversedByEntryId) {
      throw AppError.conflict(ErrorCode.CONFLICT, { reason: 'entry already reversed' });
    }

    const reversal = await this.createEntry(ctx, {
      branchId: original.branchId,
      entryDate: new Date().toISOString().slice(0, 10),
      description: `عكس القيد ${original.entryNumber}: ${reason}`,
      sourceType: 'reversal',
      sourceId: original.id,
      lines: original.lines.map((l) => ({
        accountId: l.accountId,
        branchId: l.branchId,
        debitMinor: l.creditMinor,
        creditMinor: l.debitMinor,
        description: l.description,
        customerId: l.customerId,
        doctorId: l.doctorId,
      })),
      post: true,
    });

    await this.journal.update(ctx, entryId, {
      status: 'reversed',
      reversedByEntryId: reversal.id,
    } as Partial<JournalEntry>);

    return reversal;
  }

  // ── Invoicing ────────────────────────────────────────────

  async createInvoice(ctx: AccessContext, input: CreateInvoiceInput): Promise<Invoice> {
    if (!canAccessBranch(ctx, input.branchId)) throw AppError.branchForbidden(input.branchId);
    if (input.items.length === 0) throw AppError.validation({ reason: 'invoice has no items' });

    const totals = computeInvoiceTotals(input.items);
    const issueDate = input.issueDate ?? new Date().toISOString().slice(0, 10);
    const periodCode = periodCodeFor(issueDate);
    await this.assertPeriodOpen(ctx, periodCode);

    const seq = await nextSequence(ctx.organizationId, `invoice_${input.branchId}`, 6);
    const shouldIssue = input.issue ?? true;

    const invoice = await this.invoices.create(ctx, {
      branchId: input.branchId,
      invoiceNumber: `INV-${seq.formatted}`,
      customerId: input.customerId,
      appointmentId: input.appointmentId ?? null,
      visitId: input.visitId ?? null,
      issueDate,
      dueDate: input.dueDate ?? null,
      periodCode,
      currency: 'EGP',
      items: totals.items,
      subtotalMinor: totals.subtotalMinor,
      discountMinor: totals.discountMinor,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      paidMinor: 0,
      balanceMinor: totals.totalMinor,
      status: shouldIssue ? 'issued' : 'draft',
      journalEntryId: null,
      voidedAt: null,
      voidReason: null,
      notes: input.notes ?? null,
    } as never);

    if (shouldIssue) {
      const entry = await this.postInvoiceEntry(ctx, invoice);
      await this.invoices.update(ctx, invoice.id, { journalEntryId: entry.id } as Partial<Invoice>);
      invoice.journalEntryId = entry.id;
    }

    await auditService.record(ctx, {
      action: 'accounting.invoices.create',
      entityType: 'invoice',
      entityId: invoice.id,
      branchId: input.branchId,
      after: { invoiceNumber: invoice.invoiceNumber, totalMinor: invoice.totalMinor, status: invoice.status },
    });

    return invoice;
  }

  /**
   * Dr  Accounts receivable      total
   *   Cr  Revenue                net per line (service account, or the default)
   *   Cr  Tax payable            tax
   *   Dr  Discounts allowed      discount (contra-revenue, kept visible)
   */
  private async postInvoiceEntry(ctx: AccessContext, invoice: Invoice): Promise<JournalEntry> {
    const [receivableId, defaultRevenueId, taxPayableId, discountsId] = await Promise.all([
      this.resolveSystemAccount(ctx, 'accounts_receivable'),
      this.resolveSystemAccount(ctx, 'service_revenue'),
      this.resolveSystemAccount(ctx, 'tax_payable'),
      this.resolveSystemAccount(ctx, 'sales_discounts'),
    ]);

    const lines: JournalLineInput[] = [
      {
        accountId: receivableId,
        debitMinor: invoice.totalMinor,
        customerId: invoice.customerId,
        description: `فاتورة ${invoice.invoiceNumber}`,
      },
    ];

    if (invoice.discountMinor > 0) {
      lines.push({ accountId: discountsId, debitMinor: invoice.discountMinor, description: 'خصومات' });
    }

    // Revenue is credited GROSS (before discount) and the discount is debited to a
    // contra-revenue account, so "what we charged" and "what we gave away" stay
    // separately visible instead of being netted into one number.
    for (const item of invoice.items) {
      lines.push({
        accountId: item.revenueAccountId ?? defaultRevenueId,
        creditMinor: item.lineTotalMinor - item.taxMinor + item.discountMinor,
        description: item.description,
        doctorId: item.doctorId,
      });
    }

    if (invoice.taxMinor > 0) {
      lines.push({ accountId: taxPayableId, creditMinor: invoice.taxMinor, description: 'ضرائب مستحقة' });
    }

    return this.createEntry(ctx, {
      branchId: invoice.branchId,
      entryDate: invoice.issueDate,
      description: `إثبات فاتورة ${invoice.invoiceNumber}`,
      sourceType: 'invoice',
      sourceId: invoice.id,
      lines,
      post: true,
    });
  }

  async voidInvoice(ctx: AccessContext, invoiceId: string, reason: string): Promise<Invoice> {
    const invoice = await this.invoices.requireById(ctx, invoiceId);
    if (invoice.status === 'void') throw AppError.conflict(ErrorCode.CONFLICT, { reason: 'already void' });
    if (invoice.paidMinor > 0) {
      throw AppError.conflict(ErrorCode.CONFLICT, {
        reason: 'invoice has payments — refund them before voiding',
      });
    }

    if (invoice.journalEntryId) await this.reverseEntry(ctx, invoice.journalEntryId, reason);

    const updated = await this.invoices.update(ctx, invoiceId, {
      status: 'void',
      voidedAt: new Date().toISOString(),
      voidReason: reason,
      balanceMinor: 0,
    } as Partial<Invoice>);

    await auditService.record(ctx, {
      action: 'accounting.invoices.void',
      entityType: 'invoice',
      entityId: invoiceId,
      branchId: invoice.branchId,
      before: { status: invoice.status },
      after: { status: 'void', reason },
    });

    return updated;
  }

  // ── Payments ─────────────────────────────────────────────

  /**
   * Dr  Cash / Bank / Card clearing     amount
   *   Cr  Accounts receivable           amount
   */
  async recordPayment(ctx: AccessContext, input: RecordPaymentInput): Promise<Payment> {
    if (!canAccessBranch(ctx, input.branchId)) throw AppError.branchForbidden(input.branchId);
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw AppError.validation({ reason: 'amount must be a positive integer in minor units' });
    }

    let invoice: Invoice | null = null;
    if (input.invoiceId) {
      invoice = await this.invoices.requireById(ctx, input.invoiceId);
      if (invoice.status === 'void') {
        throw AppError.conflict(ErrorCode.CONFLICT, { reason: 'invoice is void' });
      }
      if (input.amountMinor > invoice.balanceMinor) {
        throw AppError.validation({
          reason: 'payment exceeds the remaining balance',
          balanceMinor: invoice.balanceMinor,
        });
      }
    }

    const paidAt = input.paidAt ?? new Date().toISOString();
    const periodCode = periodCodeFor(paidAt);
    await this.assertPeriodOpen(ctx, periodCode);

    const debitAccountKey: SystemAccountKey =
      input.method === 'cash' ? 'cash_on_hand'
      : input.method === 'card' ? 'card_clearing'
      : input.method === 'insurance' ? 'insurance_receivable'
      : 'bank';

    const [debitAccountId, receivableId] = await Promise.all([
      this.resolveSystemAccount(ctx, debitAccountKey),
      this.resolveSystemAccount(ctx, 'accounts_receivable'),
    ]);

    const seq = await nextSequence(ctx.organizationId, `payment_${input.branchId}`, 6);

    const payment = await this.payments.create(ctx, {
      branchId: input.branchId,
      paymentNumber: `PMT-${seq.formatted}`,
      direction: 'in',
      invoiceId: input.invoiceId ?? null,
      customerId: input.customerId,
      method: input.method,
      amountMinor: input.amountMinor,
      currency: 'EGP',
      paidAt,
      periodCode,
      cashSessionId: input.cashSessionId ?? null,
      accountId: debitAccountId,
      reference: input.reference ?? null,
      journalEntryId: null,
      status: 'completed',
      notes: input.notes ?? null,
    } as never);

    const entry = await this.createEntry(ctx, {
      branchId: input.branchId,
      entryDate: paidAt.slice(0, 10),
      description: `تحصيل ${payment.paymentNumber}`,
      sourceType: 'payment',
      sourceId: payment.id,
      lines: [
        { accountId: debitAccountId, debitMinor: input.amountMinor, customerId: input.customerId },
        { accountId: receivableId, creditMinor: input.amountMinor, customerId: input.customerId },
      ],
      post: true,
    });

    await this.payments.update(ctx, payment.id, { journalEntryId: entry.id } as Partial<Payment>);

    if (invoice) {
      const paidMinor = invoice.paidMinor + input.amountMinor;
      const balanceMinor = invoice.totalMinor - paidMinor;
      await this.invoices.update(ctx, invoice.id, {
        paidMinor,
        balanceMinor,
        status: balanceMinor === 0 ? 'paid' : 'partially_paid',
      } as Partial<Invoice>);
    }

    await auditService.record(ctx, {
      action: 'accounting.payments.create',
      entityType: 'payment',
      entityId: payment.id,
      branchId: input.branchId,
      after: { paymentNumber: payment.paymentNumber, amountMinor: input.amountMinor, method: input.method },
    });

    return payment;
  }

  // ── Reporting primitives ─────────────────────────────────

  /**
   * Trial balance from posted entries. Correct and simple, but it scans every
   * entry in the range — acceptable at current volume, and the first thing to
   * move to a materialised balance table if the ledger grows large.
   */
  async trialBalance(
    ctx: AccessContext,
    fromDate: string,
    toDate: string,
    branchId?: string,
  ): Promise<Array<{ accountId: string; debitMinor: number; creditMinor: number }>> {
    const filters = [
      { field: 'status', op: '==' as const, value: 'posted' },
      { field: 'entryDate', op: '>=' as const, value: fromDate },
      { field: 'entryDate', op: '<=' as const, value: toDate },
    ];
    if (branchId) filters.push({ field: 'branchId', op: '==' as const, value: branchId });

    const totals = new Map<string, { debitMinor: number; creditMinor: number }>();
    let cursor: string | null = null;

    do {
      const page = await this.journal.list(ctx, { filters, limit: 100, cursor });
      for (const entry of page.items) {
        for (const line of entry.lines) {
          if (branchId && line.branchId !== branchId) continue;
          const acc = totals.get(line.accountId) ?? { debitMinor: 0, creditMinor: 0 };
          acc.debitMinor += line.debitMinor;
          acc.creditMinor += line.creditMinor;
          totals.set(line.accountId, acc);
        }
      }
      cursor = page.nextCursor;
    } while (cursor);

    return [...totals.entries()].map(([accountId, v]) => ({ accountId, ...v }));
  }
}

export const accountingService = new AccountingService();
