import { z } from 'zod';
import { baseEntityShape } from './base.js';

/**
 * Customer attendance = one physical visit to a branch.
 *
 * A visit is deliberately separate from an appointment:
 *  - walk-in customers have a visit with no appointment
 *  - a booked customer who never shows up has an appointment with no visit
 * Keeping them separate means the no-show report is a simple query instead of
 * a guess, and check-in works even when the booking system is bypassed.
 */

export const visitStatus = z.enum([
  'waiting',                 // checked in, in the queue
  'called',                  // called to the room
  'in_service',              // with the doctor
  'completed',               // checked out normally
  'left_without_service',    // walked out before being served
  'cancelled',
]);
export type VisitStatus = z.infer<typeof visitStatus>;

export const checkInMethod = z.enum(['reception', 'qr', 'kiosk', 'mobile', 'manual']);

export const visitSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  /** Human-facing queue number, reset per branch per day. */
  queueNumber: z.number().int().positive(),
  /** Local business day (YYYY-MM-DD in the branch timezone) — the key every daily query uses. */
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  customerId: z.string(),
  appointmentId: z.string().nullable().default(null),
  doctorId: z.string().nullable().default(null),
  departmentId: z.string().nullable().default(null),
  serviceId: z.string().nullable().default(null),

  status: visitStatus.default('waiting'),

  checkInAt: z.string(),
  checkInBy: z.string().nullable().default(null),
  checkInMethod: checkInMethod.default('reception'),

  calledAt: z.string().nullable().default(null),
  serviceStartAt: z.string().nullable().default(null),
  serviceEndAt: z.string().nullable().default(null),

  checkOutAt: z.string().nullable().default(null),
  checkOutBy: z.string().nullable().default(null),

  /** Derived on check-out. Stored so reports never recompute across thousands of docs. */
  waitMinutes: z.number().int().nonnegative().nullable().default(null),
  serviceMinutes: z.number().int().nonnegative().nullable().default(null),
  totalMinutes: z.number().int().nonnegative().nullable().default(null),

  /** True when a supervisor edited the timestamps by hand. Always audited. */
  isManualOverride: z.boolean().default(false),
  overrideReason: z.string().nullable().default(null),

  invoiceId: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type Visit = z.infer<typeof visitSchema>;

/** Per-branch, per-day counter document used to allocate queue numbers atomically. */
export const queueCounterSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  businessDate: z.string(),
  lastNumber: z.number().int().nonnegative().default(0),
});
export type QueueCounter = z.infer<typeof queueCounterSchema>;

// ── Client payloads ──────────────────────────────────────────
export const checkInInputSchema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().min(1),
  appointmentId: z.string().nullable().optional(),
  doctorId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  serviceId: z.string().nullable().optional(),
  method: checkInMethod.optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export type CheckInInput = z.infer<typeof checkInInputSchema>;

export const checkOutInputSchema = z.object({
  visitId: z.string().min(1),
  status: z.enum(['completed', 'left_without_service']).default('completed'),
  notes: z.string().max(1000).nullable().optional(),
  /** Requires attendance.override. */
  checkOutAt: z.string().datetime().optional(),
  overrideReason: z.string().max(500).optional(),
});
export type CheckOutInput = z.infer<typeof checkOutInputSchema>;
