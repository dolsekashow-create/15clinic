import type { AccessContext, AccessScope } from '@clinic/core';
import { COLLECTIONS } from '@clinic/data';
import { getDb } from '@clinic/infra';

/**
 * Resolves a user's effective permissions and branches from the database.
 *
 * Permissions deliberately do NOT live in the Firebase token. A token is
 * issued once and lives for an hour; a role change must take effect on the
 * next request, not the next hour. The cost of that correctness is one small
 * set of reads per request, mitigated by the short-lived cache below.
 */

interface ResolvedAccess {
  roleIds: string[];
  permissions: Set<string>;
  branchIds: string[];
  scope: AccessScope;
}

interface CacheEntry {
  value: ResolvedAccess;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

export function invalidateUserAccess(userId: string): void {
  for (const key of cache.keys()) if (key.startsWith(`${userId}:`)) cache.delete(key);
}

export async function resolveAccess(
  userId: string,
  organizationId: string,
  isSuperAdmin: boolean,
  tokenVersion: number,
): Promise<ResolvedAccess> {
  const cacheKey = `${userId}:${tokenVersion}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const db = getDb();

  const [roleAssignments, branchAssignments] = await Promise.all([
    db.collection(COLLECTIONS.userRoles)
      .where('organizationId', '==', organizationId)
      .where('userId', '==', userId)
      .where('isDeleted', '==', false)
      .get(),
    db.collection(COLLECTIONS.userBranches)
      .where('organizationId', '==', organizationId)
      .where('userId', '==', userId)
      .where('isDeleted', '==', false)
      .get(),
  ]);

  const roleIds = [...new Set(roleAssignments.docs.map((d) => d.get('roleId') as string))];

  // A role assignment with branchId === null grants that role org-wide.
  const hasOrgWideRole = roleAssignments.docs.some((d) => (d.get('branchId') ?? null) === null);

  const permissions = new Set<string>();
  if (roleIds.length > 0) {
    // Firestore `in` caps at 30 values; chunk to stay correct as roles grow.
    const chunks: string[][] = [];
    for (let i = 0; i < roleIds.length; i += 30) chunks.push(roleIds.slice(i, i + 30));

    const results = await Promise.all(
      chunks.map((chunk) =>
        db.collection(COLLECTIONS.rolePermissions)
          .where('organizationId', '==', organizationId)
          .where('roleId', 'in', chunk)
          .get(),
      ),
    );
    for (const snap of results) {
      for (const doc of snap.docs) permissions.add(doc.get('permissionKey') as string);
    }
  }

  const branchIds = [
    ...new Set([
      ...branchAssignments.docs.map((d) => d.get('branchId') as string),
      ...roleAssignments.docs
        .map((d) => d.get('branchId') as string | null)
        .filter((b): b is string => b !== null),
    ]),
  ];

  const scope: AccessScope = isSuperAdmin ? 'GLOBAL' : hasOrgWideRole ? 'ORGANIZATION' : 'BRANCH';

  const value: ResolvedAccess = { roleIds, permissions, branchIds, scope };
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export type { ResolvedAccess };
export type { AccessContext };
