import { AppError } from '@/server/core';
import { withAuth } from '@/server/auth';
import { accountingService } from '@/server/services';

export const runtime = 'nodejs';

/** GET .../trial-balance?from=2026-01-01&to=2026-01-31&branchId=... */
export const GET = withAuth(
  async (req, ctx) => {
    const params = new URL(req.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    if (!from || !to) throw AppError.validation({ reason: 'from and to are required' });

    const branchId = params.get('branchId') ?? undefined;
    const rows = await accountingService.trialBalance(ctx, from, to, branchId);

    const totalDebit = rows.reduce((s, r) => s + r.debitMinor, 0);
    const totalCredit = rows.reduce((s, r) => s + r.creditMinor, 0);

    return Response.json({
      data: {
        rows,
        totalDebit,
        totalCredit,
        // If this is ever false, something bypassed the posting engine.
        balanced: totalDebit === totalCredit,
      },
    });
  },
  { permission: 'accounting.reports.view' },
);
