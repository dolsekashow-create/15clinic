import type { Id } from './common.js';

export type AccessScope = 'GLOBAL' | 'ORGANIZATION' | 'BRANCH';

/**
 * The single source of truth for "who is asking and what may they touch".
 * Built once per request and threaded through every service and repository call.
 * Nothing in the data layer runs without one.
 */
export interface AccessContext {
  userId: Id;
  organizationId: Id;
  isSuperAdmin: boolean;
  roleIds: Id[];
  /** Flat set of permission keys, already resolved from roles. */
  permissions: ReadonlySet<string>;
  /** Branches this user may read/write. */
  branchIds: Id[];
  scope: AccessScope;
  /** Correlation id shared with logs and audit records. */
  requestId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export function canAccessBranch(ctx: AccessContext, branchId: Id | null): boolean {
  if (ctx.isSuperAdmin) return true;
  if (branchId === null) return true; // company-level record
  if (ctx.scope === 'ORGANIZATION' || ctx.scope === 'GLOBAL') return true;
  return ctx.branchIds.includes(branchId);
}

export function hasPermission(ctx: AccessContext, permission: string): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.permissions.has(permission);
}
