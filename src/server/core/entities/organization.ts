import { z } from 'zod';
import { baseEntityShape } from './base';

export const organizationStatus = z.enum(['active', 'suspended']);

export const organizationSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  name: z.string().min(2),
  nameEn: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  timezone: z.string().default('Africa/Cairo'),
  currency: z.string().length(3).default('EGP'),
  status: organizationStatus.default('active'),
  logoFileId: z.string().nullable().default(null),
  settings: z.record(z.unknown()).default({}),
});
export type Organization = z.infer<typeof organizationSchema>;

export const branchStatus = z.enum(['active', 'inactive', 'under_maintenance']);

export const branchSchema = z.object({
  ...baseEntityShape,
  name: z.string().min(2),
  code: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  timezone: z.string().default('Africa/Cairo'),
  managerId: z.string().nullable().default(null),
  status: branchStatus.default('active'),
  // BUSINESS_RULE_PENDING: opening hours, holidays and exceptions are undefined.
  // Stored as a free map so no booking logic depends on an invented shape yet.
  workingHours: z.record(z.unknown()).nullable().default(null),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable().default(null),
});
export type Branch = z.infer<typeof branchSchema>;

export const departmentSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1), // DECISION_PENDING: department assumed branch-scoped
  name: z.string().min(2),
  code: z.string().optional(),
  description: z.string().optional(),
  headUserId: z.string().nullable().default(null),
  status: z.enum(['active', 'inactive']).default('active'),
});
export type Department = z.infer<typeof departmentSchema>;
