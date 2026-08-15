import { z } from 'zod';
import { AppError } from '@/server/core';
import { withAuth } from '@/server/auth';
import { accountingService } from '@/server/services';

export const runtime = 'nodejs';

const itemSchema = z.object({
  serviceId: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative().optional(),
  taxRateId: z.string().nullable().optional(),
  taxRateBps: z.number().int().nonnegative().optional(),
  taxInclusive: z.boolean().optional(),
  revenueAccountId: z.string().nullable().optional(),
  doctorId: z.string().nullable().optional(),
});

const createSchema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().min(1),
  appointmentId: z.string().nullable().optional(),
  visitId: z.string().nullable().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().nullable().optional(),
  issue: z.boolean().optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const invoice = await accountingService.createInvoice(ctx, parsed.data);
    return Response.json({ data: invoice }, { status: 201 });
  },
  { permission: 'accounting.invoices.create' },
);
