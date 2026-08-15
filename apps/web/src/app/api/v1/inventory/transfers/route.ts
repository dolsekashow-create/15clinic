import { z } from 'zod';
import { AppError } from '@clinic/core';
import { withAuth } from '@clinic/auth';
import { inventoryService } from '@clinic/services';

export const runtime = 'nodejs';

const sendSchema = z.object({
  fromBranchId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toBranchId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  lines: z.array(z.object({ itemId: z.string(), quantity: z.number().positive() })).min(1),
  notes: z.string().max(500).nullable().optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = sendSchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    return Response.json({ data: await inventoryService.sendTransfer(ctx, parsed.data) }, { status: 201 });
  },
  { permission: 'inventory.transfer' },
);

const receiveSchema = z.object({ transferId: z.string().min(1) });

/** The receiving branch confirms. Only then does the stock exist on their side. */
export const PUT = withAuth(
  async (req, ctx) => {
    const parsed = receiveSchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    await inventoryService.receiveTransfer(ctx, parsed.data.transferId);
    return Response.json({ data: { ok: true } });
  },
  { permission: 'inventory.transfer.receive' },
);
