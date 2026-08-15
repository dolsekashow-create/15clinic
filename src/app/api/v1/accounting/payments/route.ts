import { z } from 'zod';
import { AppError } from '@/server/core';
import { withAuth } from '@/server/auth';
import { accountingService } from '@/server/services';

export const runtime = 'nodejs';

const schema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().min(1),
  invoiceId: z.string().nullable().optional(),
  method: z.enum(['cash', 'card', 'bank_transfer', 'wallet', 'insurance', 'other']),
  // Minor units only. A float is rejected here, by design.
  amountMinor: z.number().int().positive(),
  paidAt: z.string().optional(),
  cashSessionId: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const payment = await accountingService.recordPayment(ctx, parsed.data);
    return Response.json({ data: payment }, { status: 201 });
  },
  { permission: 'accounting.payments.create' },
);
