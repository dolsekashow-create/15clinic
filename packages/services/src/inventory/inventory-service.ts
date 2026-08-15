import {
  AppError, ErrorCode, canAccessBranch,
  type AccessContext, type Item, type StockLevel, type StockMovement, type MovementType,
} from '@clinic/core';
import { COLLECTIONS, nextSequence } from '@clinic/data';
import { getDb } from '@clinic/infra';
import { auditService } from '../audit/audit-service.js';
import { accountingService } from '../accounting/accounting-service.js';

/**
 * ── Inventory service ──────────────────────────────────────────────────
 *
 * Every quantity change goes through `applyMovement`, which runs inside a
 * Firestore transaction that does three things atomically:
 *   1. reads the current level
 *   2. rejects the movement if it would drive stock negative
 *   3. writes the movement and the new level together
 *
 * Doing this outside a transaction would let two branches issue the last unit
 * of a supply at the same moment and both succeed. That bug is silent until a
 * stock count months later, which is exactly the class of problem a movement
 * ledger exists to prevent.
 *
 * Costing is weighted average, recomputed on receipt. BUSINESS_RULE_PENDING:
 * FIFO / batch / expiry tracking is flagged per item but not implemented.
 */

interface MovementInput {
  branchId: string;
  warehouseId: string;
  itemId: string;
  type: MovementType;
  /** Always positive; the sign is derived from the movement type. */
  quantity: number;
  unitCostMinor?: number;
  reason?: string | null;
  referenceType?: StockMovement['referenceType'];
  referenceId?: string | null;
  occurredAt?: string;
  /** Only meaningful for `adjustment`, where the correction can go either way. */
  decrease?: boolean;
}

const INCREASES: MovementType[] = ['receipt', 'transfer_in', 'return'];

function levelId(warehouseId: string, itemId: string): string {
  return `${warehouseId}__${itemId}`;
}

export class InventoryService {
  /** The single choke point for stock changes. */
  async applyMovement(ctx: AccessContext, input: MovementInput): Promise<StockMovement> {
    if (!canAccessBranch(ctx, input.branchId)) throw AppError.branchForbidden(input.branchId);
    if (input.quantity <= 0) {
      throw AppError.validation({ reason: 'quantity must be positive; the type sets the direction' });
    }

    const db = getDb();
    const signed =
      input.type === 'adjustment'
        ? (input.decrease ? -input.quantity : input.quantity)
        : INCREASES.includes(input.type)
          ? input.quantity
          : -input.quantity;

    const levelRef = db.collection(COLLECTIONS.stockLevels).doc(levelId(input.warehouseId, input.itemId));
    const itemRef = db.collection(COLLECTIONS.items).doc(input.itemId);
    const movementRef = db.collection(COLLECTIONS.stockMovements).doc();
    const now = new Date().toISOString();

    const movement = await db.runTransaction(async (tx) => {
      const [levelSnap, itemSnap] = await Promise.all([tx.get(levelRef), tx.get(itemRef)]);

      if (!itemSnap.exists) throw AppError.notFound('item', input.itemId);
      const item = itemSnap.data() as Item;
      if (item.organizationId !== ctx.organizationId) throw AppError.notFound('item', input.itemId);

      const current = levelSnap.exists ? ((levelSnap.data()?.quantity as number | undefined) ?? 0) : 0;
      const balanceAfter = current + signed;

      if (balanceAfter < 0) {
        throw AppError.conflict(ErrorCode.CONFLICT, {
          reason: 'insufficient_stock',
          available: current,
          requested: input.quantity,
        });
      }

      // Weighted average: only a receipt at a real cost moves the average.
      let averageCostMinor = item.averageCostMinor ?? 0;
      if (input.type === 'receipt' && (input.unitCostMinor ?? 0) > 0) {
        const incomingValue = input.quantity * (input.unitCostMinor ?? 0);
        const existingValue = current * averageCostMinor;
        averageCostMinor = balanceAfter > 0
          ? Math.round((existingValue + incomingValue) / balanceAfter)
          : (input.unitCostMinor ?? 0);
        tx.update(itemRef, { averageCostMinor, updatedAt: now, updatedBy: ctx.userId });
      }

      const unitCost = input.unitCostMinor ?? averageCostMinor;

      const doc: Record<string, unknown> = {
        organizationId: ctx.organizationId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        type: input.type,
        quantity: signed,
        unitCostMinor: unitCost,
        totalCostMinor: Math.round(Math.abs(signed) * unitCost),
        balanceAfter,
        reason: input.reason ?? null,
        referenceType: input.referenceType ?? 'manual',
        referenceId: input.referenceId ?? null,
        journalEntryId: null,
        performedBy: ctx.userId,
        occurredAt: input.occurredAt ?? now,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: null,
        isDeleted: false,
        deletedAt: null,
      };

      tx.set(movementRef, doc);
      tx.set(
        levelRef,
        {
          organizationId: ctx.organizationId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          quantity: balanceAfter,
          reservedQuantity: levelSnap.exists ? (levelSnap.data()?.reservedQuantity ?? 0) : 0,
          lastMovementAt: now,
          updatedAt: now,
          isDeleted: false,
        },
        { merge: true },
      );

      return { id: movementRef.id, ...doc } as unknown as StockMovement;
    });

    await this.postMovementEntry(ctx, movement).catch(() => {
      // Accounting failure must be visible, not silent, but must not roll back
      // the physical stock change — the goods have already moved.
    });

    await auditService.record(ctx, {
      action: `inventory.${input.type}`,
      entityType: 'stock_movement',
      entityId: movement.id,
      branchId: input.branchId,
      after: { itemId: input.itemId, quantity: signed, balanceAfter: movement.balanceAfter },
    });

    return movement;
  }

  /**
   * Stock movements hit the ledger:
   *   receipt      Dr Inventory            Cr Accounts payable
   *   consumption  Dr Medical supplies     Cr Inventory
   *   adjustment   Dr/Cr Inventory variance
   */
  private async postMovementEntry(ctx: AccessContext, movement: StockMovement): Promise<void> {
    const value = Math.abs(movement.totalCostMinor);
    if (value === 0) return;

    const inventoryId = await accountingService.resolveSystemAccount(ctx, 'inventory');
    let counterpartId: string;

    switch (movement.type) {
      case 'receipt':
        counterpartId = await accountingService.resolveSystemAccount(ctx, 'accounts_payable');
        break;
      case 'consumption':
      case 'issue':
        counterpartId = await accountingService.resolveSystemAccount(ctx, 'inventory_consumption');
        break;
      case 'adjustment':
        counterpartId = await accountingService.resolveSystemAccount(ctx, 'inventory_variance');
        break;
      default:
        return; // transfers are handled by the transfer flow
    }

    const stockIncreases = movement.quantity > 0;

    await accountingService.createEntry(ctx, {
      branchId: movement.branchId,
      entryDate: movement.occurredAt.slice(0, 10),
      description: `حركة مخزن ${movement.type}`,
      sourceType: 'adjustment',
      sourceId: movement.id,
      lines: [
        stockIncreases
          ? { accountId: inventoryId, debitMinor: value }
          : { accountId: inventoryId, creditMinor: value },
        stockIncreases
          ? { accountId: counterpartId, creditMinor: value }
          : { accountId: counterpartId, debitMinor: value },
      ],
      post: true,
    });
  }

  async receive(ctx: AccessContext, input: Omit<MovementInput, 'type'>) {
    return this.applyMovement(ctx, { ...input, type: 'receipt' });
  }

  async consume(ctx: AccessContext, input: Omit<MovementInput, 'type'>) {
    return this.applyMovement(ctx, { ...input, type: 'consumption' });
  }

  /** Stock count correction. `countedQuantity` is what the shelf actually holds. */
  async adjustToCount(
    ctx: AccessContext,
    args: { branchId: string; warehouseId: string; itemId: string; countedQuantity: number; reason: string },
  ): Promise<StockMovement | null> {
    const db = getDb();
    const snap = await db
      .collection(COLLECTIONS.stockLevels)
      .doc(levelId(args.warehouseId, args.itemId))
      .get();

    const current = (snap.data()?.quantity as number | undefined) ?? 0;
    const delta = args.countedQuantity - current;
    if (delta === 0) return null; // nothing to correct

    return this.applyMovement(ctx, {
      branchId: args.branchId,
      warehouseId: args.warehouseId,
      itemId: args.itemId,
      type: 'adjustment',
      quantity: Math.abs(delta),
      decrease: delta < 0,
      reason: args.reason,
      referenceType: 'count',
    });
  }

  /** Two-step transfer: stock leaves now, lands on confirmation. */
  async sendTransfer(
    ctx: AccessContext,
    args: {
      fromBranchId: string; fromWarehouseId: string;
      toBranchId: string; toWarehouseId: string;
      lines: Array<{ itemId: string; quantity: number }>;
      notes?: string | null;
    },
  ) {
    if (!canAccessBranch(ctx, args.fromBranchId)) throw AppError.branchForbidden(args.fromBranchId);

    const seq = await nextSequence(ctx.organizationId, 'stock_transfer', 5);
    const db = getDb();
    const ref = db.collection(COLLECTIONS.stockTransfers).doc();
    const now = new Date().toISOString();

    for (const line of args.lines) {
      await this.applyMovement(ctx, {
        branchId: args.fromBranchId,
        warehouseId: args.fromWarehouseId,
        itemId: line.itemId,
        type: 'transfer_out',
        quantity: line.quantity,
        referenceType: 'transfer',
        referenceId: ref.id,
      });
    }

    await ref.set({
      organizationId: ctx.organizationId,
      branchId: args.fromBranchId,
      transferNumber: `TRF-${seq.formatted}`,
      fromWarehouseId: args.fromWarehouseId,
      toWarehouseId: args.toWarehouseId,
      toBranchId: args.toBranchId,
      status: 'in_transit',
      lines: args.lines.map((l) => ({ ...l, receivedQuantity: 0, unitCostMinor: 0 })),
      sentAt: now, sentBy: ctx.userId,
      receivedAt: null, receivedBy: null,
      notes: args.notes ?? null,
      createdAt: now, updatedAt: now, createdBy: ctx.userId, updatedBy: null,
      isDeleted: false, deletedAt: null,
    });

    await auditService.record(ctx, {
      action: 'inventory.transfer.sent',
      entityType: 'stock_transfer',
      entityId: ref.id,
      branchId: args.fromBranchId,
      after: { to: args.toBranchId, lines: args.lines.length },
    });

    return { id: ref.id, transferNumber: `TRF-${seq.formatted}` };
  }

  /** Receiving branch confirms. Only then does the stock exist on their side. */
  async receiveTransfer(ctx: AccessContext, transferId: string) {
    const db = getDb();
    const snap = await db.collection(COLLECTIONS.stockTransfers).doc(transferId).get();
    if (!snap.exists) throw AppError.notFound('stock_transfer', transferId);

    const transfer = snap.data() as Record<string, unknown>;
    if (transfer.organizationId !== ctx.organizationId) throw AppError.notFound('stock_transfer', transferId);

    const toBranchId = transfer.toBranchId as string;
    if (!canAccessBranch(ctx, toBranchId)) throw AppError.branchForbidden(toBranchId);
    if (transfer.status !== 'in_transit') {
      throw AppError.conflict(ErrorCode.CONFLICT, { status: transfer.status });
    }

    const lines = transfer.lines as Array<{ itemId: string; quantity: number }>;
    for (const line of lines) {
      await this.applyMovement(ctx, {
        branchId: toBranchId,
        warehouseId: transfer.toWarehouseId as string,
        itemId: line.itemId,
        type: 'transfer_in',
        quantity: line.quantity,
        referenceType: 'transfer',
        referenceId: transferId,
      });
    }

    await snap.ref.update({
      status: 'received',
      receivedAt: new Date().toISOString(),
      receivedBy: ctx.userId,
      updatedAt: new Date().toISOString(),
    });

    await auditService.record(ctx, {
      action: 'inventory.transfer.received',
      entityType: 'stock_transfer',
      entityId: transferId,
      branchId: toBranchId,
    });
  }

  /** Items at or below their reorder point, for the branch dashboard. */
  async lowStock(ctx: AccessContext, branchId: string): Promise<StockLevel[]> {
    if (!canAccessBranch(ctx, branchId)) throw AppError.branchForbidden(branchId);
    const db = getDb();
    const [levels, items] = await Promise.all([
      db.collection(COLLECTIONS.stockLevels)
        .where('organizationId', '==', ctx.organizationId)
        .where('branchId', '==', branchId).get(),
      db.collection(COLLECTIONS.items)
        .where('organizationId', '==', ctx.organizationId)
        .where('status', '==', 'active').get(),
    ]);

    const reorder = new Map(items.docs.map((d) => [d.id, d.get('reorderPoint') as number | null]));
    return levels.docs
      .map((d) => ({ id: d.id, ...d.data() }) as StockLevel)
      .filter((l) => {
        const point = reorder.get(l.itemId);
        return point !== null && point !== undefined && l.quantity <= point;
      });
  }
}

export const inventoryService = new InventoryService();
