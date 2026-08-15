import { z } from 'zod';
import { AppError } from '@/server/core';
import { withAuth } from '@/server/auth';
import { inventoryService } from '@/server/services';

export const runtime = 'nodejs';

const schema = z.object({
  branchId: z.string().min(1),
  warehouseId: z.string().min(1),
  itemId: z.string().min(1),
  type: z.enum(['receipt', 'issue', 'consumption', 'adjustment', 'return']),
  quantity: z.number().positive(),
  unitCostMinor: z.number().int().nonnegative().optional(),
  decrease: z.boolean().optional(),
  reason: z.string().max(500).nullable().optional(),
  referenceType: z.enum(['purchase', 'transfer', 'appointment', 'visit', 'count', 'manual']).optional(),
  referenceId: z.string().nullable().optional(),
});

/**
 * Every stock change enters through here. Which permission is required depends
 * on the direction of the movement — receiving goods and writing off a count
 * discrepancy are very different levels of trust.
 */
export const POST = withAuth(
  async (req, ctx) => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const required =
      parsed.data.type === 'receipt' ? 'inventory.receive'
      : parsed.data.type === 'adjustment' ? 'inventory.adjust'
      : 'inventory.issue';

    if (!ctx.permissions.has(required) && !ctx.isSuperAdmin) {
      throw AppError.forbidden({ required });
    }

    const movement = await inventoryService.applyMovement(ctx, parsed.data);
    return Response.json({ data: movement }, { status: 201 });
  },
  { anyOf: ['inventory.receive', 'inventory.issue', 'inventory.adjust'] },
);
