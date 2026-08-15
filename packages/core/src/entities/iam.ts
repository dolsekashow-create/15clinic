import { z } from 'zod';
import { baseEntityShape, emailSchema, phoneSchema } from './base.js';

export const userStatus = z.enum(['active', 'pending', 'suspended', 'disabled']);

export const userSchema = z.object({
  ...baseEntityShape,
  /** Firebase Auth uid. The only link between our records and the identity provider. */
  authUid: z.string().min(1),
  fullName: z.string().min(2),
  email: emailSchema,
  phone: phoneSchema.nullable().default(null),
  avatarFileId: z.string().nullable().default(null),
  jobTitle: z.string().nullable().default(null),
  primaryBranchId: z.string().nullable().default(null),
  status: userStatus.default('pending'),
  /** Bumped to invalidate every existing session for this user. */
  tokenVersion: z.number().int().nonnegative().default(0),
  lastLoginAt: z.string().nullable().default(null),
  locale: z.enum(['ar', 'en']).default('ar'),
});
export type User = z.infer<typeof userSchema>;

export const roleSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  key: z.string().regex(/^[a-z_]+$/),
  nameAr: z.string().min(2),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  /** System roles cannot be deleted or renamed. */
  isSystem: z.boolean().default(false),
  level: z.number().int().default(100),
});
export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  key: z.string(),
  resource: z.string(),
  action: z.string(),
  group: z.string(),
  labelAr: z.string(),
});
export type Permission = z.infer<typeof permissionSchema>;

export const rolePermissionSchema = z.object({
  ...baseEntityShape,
  branchId: z.null(),
  roleId: z.string(),
  permissionKey: z.string(),
});
export type RolePermission = z.infer<typeof rolePermissionSchema>;

/**
 * A role granted to a user, optionally scoped to one branch.
 * `branchId === null` grants the role across the whole organisation.
 * This is what lets one person be Branch Manager in branch 3 and
 * Receptionist in branch 7 without any schema change.
 */
export const userRoleSchema = z.object({
  ...baseEntityShape,
  userId: z.string(),
  roleId: z.string(),
  assignedBy: z.string().nullable().default(null),
  assignedAt: z.string(),
});
export type UserRole = z.infer<typeof userRoleSchema>;

export const userBranchSchema = z.object({
  ...baseEntityShape,
  branchId: z.string().min(1),
  userId: z.string(),
  isPrimary: z.boolean().default(false),
  assignedAt: z.string(),
});
export type UserBranch = z.infer<typeof userBranchSchema>;
