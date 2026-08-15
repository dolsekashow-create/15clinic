import {
  AppError, ErrorCode, canAccessBranch,
  type AccessContext, type CheckInInput, type CheckOutInput, type Visit,
} from '@clinic/core';
import { BranchRepository, COLLECTIONS, CustomerRepository, VisitRepository } from '@clinic/data';
import { getDb } from '@clinic/infra';
import { auditService } from '../audit/audit-service.js';

/**
 * Customer check-in / check-out.
 *
 * Design notes:
 *  - The queue number is allocated inside a Firestore transaction. Two
 *    receptionists pressing "check in" at the same instant must not get the
 *    same number, and a read-then-write would allow exactly that.
 *  - `businessDate` is computed in the BRANCH timezone, not the server's.
 *    A 1 a.m. visit in Cairo must not land on the previous UTC day.
 *  - Durations are computed once at check-out and stored. Reports then read
 *    a field instead of recomputing across thousands of documents.
 *
 * BUSINESS_RULE_PENDING: whether a visit may be opened without an appointment,
 * whether late arrivals lose their slot, and any queue-priority rules.
 * Today walk-ins are allowed and the queue is strictly first-come.
 */

const OPEN_STATUSES = ['waiting', 'called', 'in_service'] as const;

function businessDateIn(timezone: string, at: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD directly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

export class AttendanceService {
  private readonly visits = new VisitRepository();
  private readonly customers = new CustomerRepository();
  private readonly branches = new BranchRepository();

  /** Allocates the next queue number for a branch/day atomically. */
  private async nextQueueNumber(
    organizationId: string,
    branchId: string,
    businessDate: string,
  ): Promise<number> {
    const db = getDb();
    const ref = db
      .collection(COLLECTIONS.queueCounters)
      .doc(`${organizationId}__${branchId}__${businessDate}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const last = snap.exists ? ((snap.data()?.lastNumber as number | undefined) ?? 0) : 0;
      const next = last + 1;
      tx.set(
        ref,
        { organizationId, branchId, businessDate, lastNumber: next, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return next;
    });
  }

  async checkIn(ctx: AccessContext, input: CheckInInput): Promise<Visit> {
    if (!canAccessBranch(ctx, input.branchId)) throw AppError.branchForbidden(input.branchId);

    const branch = await this.branches.requireById(ctx, input.branchId);
    if (branch.status !== 'active') {
      throw AppError.conflict(ErrorCode.CONFLICT, { reason: 'branch_not_active' });
    }

    // Customer must exist and belong to the same organisation (enforced by the repo).
    const customer = await this.customers.requireById(ctx, input.customerId);
    if (customer.status === 'blocked') {
      throw AppError.conflict(ErrorCode.CONFLICT, { reason: 'customer_blocked' });
    }

    const businessDate = businessDateIn(branch.timezone ?? 'Africa/Cairo');

    // One open visit per customer per branch per day.
    const existing = await this.visits.list(ctx, {
      filters: [
        { field: 'branchId', op: '==', value: input.branchId },
        { field: 'customerId', op: '==', value: input.customerId },
        { field: 'businessDate', op: '==', value: businessDate },
        { field: 'status', op: 'in', value: [...OPEN_STATUSES] },
      ],
      limit: 1,
    });
    if (existing.items.length > 0) {
      throw new AppError(ErrorCode.ALREADY_CHECKED_IN, 409, { visitId: existing.items[0]!.id });
    }

    const queueNumber = await this.nextQueueNumber(ctx.organizationId, input.branchId, businessDate);
    const now = new Date().toISOString();

    const visit = await this.visits.create(ctx, {
      branchId: input.branchId,
      queueNumber,
      businessDate,
      customerId: input.customerId,
      appointmentId: input.appointmentId ?? null,
      doctorId: input.doctorId ?? null,
      departmentId: input.departmentId ?? null,
      serviceId: input.serviceId ?? null,
      status: 'waiting',
      checkInAt: now,
      checkInBy: ctx.userId,
      checkInMethod: input.method ?? 'reception',
      calledAt: null,
      serviceStartAt: null,
      serviceEndAt: null,
      checkOutAt: null,
      checkOutBy: null,
      waitMinutes: null,
      serviceMinutes: null,
      totalMinutes: null,
      isManualOverride: false,
      overrideReason: null,
      invoiceId: null,
      notes: input.notes ?? null,
    } as never);

    await auditService.record(ctx, {
      action: 'attendance.check_in',
      entityType: 'visit',
      entityId: visit.id,
      branchId: input.branchId,
      after: { customerId: input.customerId, queueNumber, checkInAt: now },
    });

    return visit;
  }

  /** Marks the customer as called to the room. */
  async markCalled(ctx: AccessContext, visitId: string): Promise<Visit> {
    const visit = await this.visits.requireById(ctx, visitId);
    if (visit.status !== 'waiting') {
      throw AppError.conflict(ErrorCode.CONFLICT, { status: visit.status });
    }
    const updated = await this.visits.update(ctx, visitId, {
      status: 'called',
      calledAt: new Date().toISOString(),
    } as Partial<Visit>);
    await auditService.record(ctx, {
      action: 'attendance.called', entityType: 'visit', entityId: visitId, branchId: visit.branchId,
    });
    return updated;
  }

  /** Doctor started the service. */
  async startService(ctx: AccessContext, visitId: string, doctorId?: string): Promise<Visit> {
    const visit = await this.visits.requireById(ctx, visitId);
    if (visit.status !== 'waiting' && visit.status !== 'called') {
      throw AppError.conflict(ErrorCode.CONFLICT, { status: visit.status });
    }
    const now = new Date().toISOString();
    const updated = await this.visits.update(ctx, visitId, {
      status: 'in_service',
      serviceStartAt: now,
      waitMinutes: minutesBetween(visit.checkInAt, now),
      ...(doctorId ? { doctorId } : {}),
    } as Partial<Visit>);
    await auditService.record(ctx, {
      action: 'attendance.service_started', entityType: 'visit', entityId: visitId, branchId: visit.branchId,
    });
    return updated;
  }

  async checkOut(ctx: AccessContext, input: CheckOutInput): Promise<Visit> {
    const visit = await this.visits.requireById(ctx, input.visitId);

    if (!(OPEN_STATUSES as readonly string[]).includes(visit.status)) {
      throw new AppError(ErrorCode.NOT_CHECKED_IN, 409, { status: visit.status });
    }

    // Back-dating a check-out is a supervisor action and is always audited.
    const isOverride = Boolean(input.checkOutAt);
    if (isOverride && !ctx.permissions.has('attendance.override') && !ctx.isSuperAdmin) {
      throw AppError.forbidden({ required: 'attendance.override' });
    }

    const checkOutAt = input.checkOutAt ?? new Date().toISOString();
    if (new Date(checkOutAt).getTime() < new Date(visit.checkInAt).getTime()) {
      throw AppError.validation({ reason: 'checkOutAt is before checkInAt' });
    }

    const serviceEndAt = visit.serviceStartAt ? checkOutAt : null;
    const patch: Partial<Visit> = {
      status: input.status,
      checkOutAt,
      checkOutBy: ctx.userId,
      serviceEndAt,
      waitMinutes: visit.waitMinutes ?? minutesBetween(visit.checkInAt, visit.serviceStartAt ?? checkOutAt),
      serviceMinutes: visit.serviceStartAt ? minutesBetween(visit.serviceStartAt, checkOutAt) : 0,
      totalMinutes: minutesBetween(visit.checkInAt, checkOutAt),
      isManualOverride: isOverride,
      overrideReason: input.overrideReason ?? null,
      notes: input.notes ?? visit.notes,
    };

    const updated = await this.visits.update(ctx, input.visitId, patch);

    await auditService.record(ctx, {
      action: isOverride ? 'attendance.check_out_override' : 'attendance.check_out',
      entityType: 'visit',
      entityId: input.visitId,
      branchId: visit.branchId,
      before: { status: visit.status, checkOutAt: visit.checkOutAt },
      after: { status: patch.status, checkOutAt, totalMinutes: patch.totalMinutes },
    });

    return updated;
  }

  /** Live queue for a branch today — the reception screen. */
  async todayQueue(ctx: AccessContext, branchId: string, timezone = 'Africa/Cairo') {
    if (!canAccessBranch(ctx, branchId)) throw AppError.branchForbidden(branchId);
    return this.visits.list(ctx, {
      filters: [
        { field: 'branchId', op: '==', value: branchId },
        { field: 'businessDate', op: '==', value: businessDateIn(timezone) },
      ],
      orderBy: { field: 'queueNumber', direction: 'asc' },
      limit: 100,
    });
  }
}

export const attendanceService = new AttendanceService();
export { businessDateIn, minutesBetween };
