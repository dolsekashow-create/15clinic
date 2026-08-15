import { z } from 'zod';
import { baseEntityShape, emailSchema, phoneSchema } from './base';

export const customerSchema = z.object({
  ...baseEntityShape,
  /** Company-level record with a home branch. Visible per branch via visits/appointments. */
  branchId: z.null(),
  code: z.string(),
  fullName: z.string().min(2),
  phone: phoneSchema,
  altPhone: phoneSchema.nullable().default(null),
  email: emailSchema.nullable().default(null),
  gender: z.enum(['male', 'female', 'unspecified']).default('unspecified'),
  birthDate: z.string().nullable().default(null),
  /** @sensitive — redacted from audit diffs. */
  nationalId: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  primaryBranchId: z.string(),
  source: z.enum(['walk_in', 'web', 'mobile', 'referral', 'other']).default('walk_in'),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().default(null),
  /** Set when the customer registers through the mobile app. */
  mobileAuthUid: z.string().nullable().default(null),
  /** Normalised tokens for prefix search (Firestore has no LIKE). */
  searchTokens: z.array(z.string()).default([]),
  // BUSINESS_RULE_PENDING: no medical/clinical fields until the client defines them.
});
export type Customer = z.infer<typeof customerSchema>;

export const doctorSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  /** Null when the doctor is only a record and does not log into the system. */
  userId: z.string().nullable().default(null),
  fullName: z.string().min(2),
  specialization: z.string(),
  licenseNumber: z.string().nullable().default(null),
  phone: phoneSchema.nullable().default(null),
  email: emailSchema.nullable().default(null),
  branchIds: z.array(z.string()).default([]),
  departmentId: z.string().nullable().default(null),
  bio: z.string().nullable().default(null),
  avatarFileId: z.string().nullable().default(null),
  status: z.enum(['active', 'on_leave', 'inactive']).default('active'),
  // BUSINESS_RULE_PENDING: fees, commissions and availability schedules undefined.
});
export type Doctor = z.infer<typeof doctorSchema>;

export const serviceSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  name: z.string().min(2),
  nameEn: z.string().optional(),
  code: z.string(),
  description: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  durationMinutes: z.number().int().positive().nullable().default(null),
  branchIds: z.array(z.string()).default([]),
  status: z.enum(['active', 'inactive']).default('active'),
  /**
   * Price is nullable and purely informational until the client confirms
   * pricing rules. Invoicing takes the price from the invoice line, never
   * from here, so a later price change never rewrites history.
   */
  defaultPriceMinor: z.number().int().nonnegative().nullable().default(null),
  defaultTaxRateId: z.string().nullable().default(null),
  /** Revenue account used when this service is invoiced. */
  revenueAccountId: z.string().nullable().default(null),
});
export type Service = z.infer<typeof serviceSchema>;

/** Statuses are data, not code — read from system_settings so the client can change them. */
export const DEFAULT_APPOINTMENT_STATUSES = [
  'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show',
] as const;

export const appointmentSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  code: z.string(),
  customerId: z.string(),
  doctorId: z.string().nullable().default(null),
  serviceId: z.string().nullable().default(null),
  departmentId: z.string().nullable().default(null),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  status: z.string().default('scheduled'),
  statusHistory: z
    .array(
      z.object({
        status: z.string(),
        changedBy: z.string().nullable(),
        changedAt: z.string(),
        reason: z.string().nullable().default(null),
      }),
    )
    .default([]),
  source: z.enum(['dashboard', 'mobile', 'web', 'phone']).default('dashboard'),
  notes: z.string().nullable().default(null),
  /** Prevents duplicate bookings when the mobile app retries on a flaky network. */
  idempotencyKey: z.string().nullable().default(null),
  visitId: z.string().nullable().default(null),
  invoiceId: z.string().nullable().default(null),
  // BUSINESS_RULE_PENDING: cancellation window, fees, overlap rules, payment gating.
});
export type Appointment = z.infer<typeof appointmentSchema>;
