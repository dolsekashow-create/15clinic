import { z } from 'zod';
import { baseEntityShape, minorAmountSchema } from './base';

/**
 * ── Inventory ──────────────────────────────────────────────────────────
 *
 * Model: warehouses hold items; every quantity change is an immutable
 * MOVEMENT, and `stock_levels` is a running cache of those movements.
 *
 * Why movements rather than editing a quantity field: an editable number tells
 * you what someone last typed. A movement ledger tells you what happened, who
 * did it, and why — which is the only way a stock count discrepancy across 15
 * branches can ever be investigated. It is the same reasoning as the journal.
 *
 * Costing: weighted average, the standard default. FIFO/batch costing is a
 * per-item flag hook (`trackBatches`) but is NOT implemented until the client
 * confirms they need it.
 */

export const warehouseSchema = z.object({
  ...baseEntityShape,
  /** Warehouses belong to a branch; a central store uses the HQ branch. */
  branchId: z.string().min(1),
  name: z.string().min(2),
  code: z.string().min(1),
  type: z.enum(['main', 'branch_store', 'consumption_point']).default('branch_store'),
  managerId: z.string().nullable().default(null),
  status: z.enum(['active', 'inactive']).default('active'),
});
export type Warehouse = z.infer<typeof warehouseSchema>;

export const itemSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  sku: z.string().min(1),
  name: z.string().min(2),
  nameEn: z.string().optional(),
  categoryId: z.string().nullable().default(null),
  /** Base unit of measure: piece, box, ml, ... */
  unit: z.string().default('قطعة'),
  barcode: z.string().nullable().default(null),
  isConsumable: z.boolean().default(true),
  trackBatches: z.boolean().default(false), // BUSINESS_RULE_PENDING: batch/expiry tracking
  reorderPoint: z.number().int().nonnegative().nullable().default(null),
  /** Weighted-average cost, recomputed on every receipt. */
  averageCostMinor: minorAmountSchema.nonnegative().default(0),
  /** Asset account the stock sits in, and the expense account on consumption. */
  inventoryAccountId: z.string().nullable().default(null),
  expenseAccountId: z.string().nullable().default(null),
  status: z.enum(['active', 'archived']).default('active'),
  searchTokens: z.array(z.string()).default([]),
});
export type Item = z.infer<typeof itemSchema>;

/** Running balance per item per warehouse. Derived, never authoritative. */
export const stockLevelSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  warehouseId: z.string(),
  itemId: z.string(),
  quantity: z.number().default(0),
  /** Reserved but not yet issued (e.g. allocated to a scheduled procedure). */
  reservedQuantity: z.number().default(0),
  lastMovementAt: z.string().nullable().default(null),
});
export type StockLevel = z.infer<typeof stockLevelSchema>;

export const movementType = z.enum([
  'receipt',       // purchase / opening balance in
  'issue',         // out to a consumption point
  'consumption',   // used on a patient or internally
  'transfer_out',
  'transfer_in',
  'adjustment',    // stock count correction
  'return',
]);
export type MovementType = z.infer<typeof movementType>;

/** Immutable. A wrong movement is corrected by a reversing movement. */
export const stockMovementSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  warehouseId: z.string(),
  itemId: z.string(),
  type: movementType,
  /** Signed: positive increases stock, negative decreases it. */
  quantity: z.number(),
  unitCostMinor: minorAmountSchema.nonnegative().default(0),
  totalCostMinor: minorAmountSchema.default(0),
  /** Balance after this movement — makes a stock card readable without replay. */
  balanceAfter: z.number(),
  reason: z.string().nullable().default(null),
  referenceType: z.enum(['purchase', 'transfer', 'appointment', 'visit', 'count', 'manual']).default('manual'),
  referenceId: z.string().nullable().default(null),
  journalEntryId: z.string().nullable().default(null),
  performedBy: z.string(),
  occurredAt: z.string(),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

/**
 * Branch-to-branch transfer. Two-step on purpose: stock leaves the sender
 * immediately and only lands at the receiver on confirmation, so goods in
 * transit are visible instead of vanishing from both sides.
 */
export const stockTransferSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1), // sending branch
  transferNumber: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  toBranchId: z.string(),
  status: z.enum(['draft', 'in_transit', 'received', 'cancelled']).default('draft'),
  lines: z
    .array(
      z.object({
        itemId: z.string(),
        quantity: z.number().positive(),
        receivedQuantity: z.number().nonnegative().default(0),
        unitCostMinor: minorAmountSchema.nonnegative().default(0),
      }),
    )
    .min(1),
  sentAt: z.string().nullable().default(null),
  sentBy: z.string().nullable().default(null),
  receivedAt: z.string().nullable().default(null),
  receivedBy: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type StockTransfer = z.infer<typeof stockTransferSchema>;
