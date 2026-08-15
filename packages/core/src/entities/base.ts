import { z } from 'zod';

/** Fields the server always controls. Clients may never send these. */
export const baseEntityShape = {
  id: z.string().min(1),
  organizationId: z.string().min(1),
  branchId: z.string().min(1).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  isDeleted: z.boolean().default(false),
  deletedAt: z.string().nullable().default(null),
  isDemo: z.boolean().optional(),
};

export const baseEntitySchema = z.object(baseEntityShape);

/** Keys stripped from any client payload before it reaches a service. */
export const SERVER_CONTROLLED_FIELDS = [
  'id', 'organizationId', 'createdAt', 'updatedAt',
  'createdBy', 'updatedBy', 'isDeleted', 'deletedAt', 'isDemo',
] as const;

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'رقم هاتف غير صحيح');

export const emailSchema = z.string().trim().toLowerCase().email('بريد إلكتروني غير صحيح');

/** Integer minor units. Rejects floats outright so rounding bugs cannot enter the ledger. */
export const minorAmountSchema = z.number().int('المبالغ تُخزَّن كأعداد صحيحة بالقروش');
