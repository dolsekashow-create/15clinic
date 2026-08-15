import { randomUUID } from 'node:crypto';
import { AppError, ErrorCode, type AccessContext } from '@clinic/core';
import { COLLECTIONS } from '@clinic/data';
import { getAdminAuth, getDb } from '@clinic/infra';
import { resolveAccess } from './permission-resolver.js';

export interface RequestIdentity {
  /** Session cookie (dashboard) — httpOnly, unreadable from JavaScript. */
  sessionCookie?: string | null;
  /** Bearer id token (mobile app). */
  bearerToken?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string;
}

/**
 * Turns an incoming request into an AccessContext, or throws.
 * Both entry points (web cookie, mobile bearer) converge on the same context,
 * so authorisation behaves identically across clients.
 */
export async function resolveAccessContext(identity: RequestIdentity): Promise<AccessContext> {
  const auth = getAdminAuth();
  const requestId = identity.requestId ?? randomUUID();

  let decoded;
  try {
    if (identity.sessionCookie) {
      // checkRevoked: a disabled user's session dies immediately.
      decoded = await auth.verifySessionCookie(identity.sessionCookie, true);
    } else if (identity.bearerToken) {
      decoded = await auth.verifyIdToken(identity.bearerToken, true);
    } else {
      throw AppError.unauthenticated();
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCode.SESSION_EXPIRED, 401, { cause: String(err) });
  }

  const db = getDb();
  const userSnap = await db
    .collection(COLLECTIONS.users)
    .where('authUid', '==', decoded.uid)
    .limit(1)
    .get();

  const userDoc = userSnap.docs[0];
  if (!userDoc) throw AppError.unauthenticated({ reason: 'no user record for uid' });

  const status = userDoc.get('status') as string;
  if (status !== 'active') throw new AppError(ErrorCode.ACCOUNT_NOT_ACTIVE, 403, { status });

  const organizationId = userDoc.get('organizationId') as string;
  const tokenVersion = (userDoc.get('tokenVersion') as number | undefined) ?? 0;
  const isSuperAdmin = decoded.isSuperAdmin === true;

  const access = await resolveAccess(userDoc.id, organizationId, isSuperAdmin, tokenVersion);

  return {
    userId: userDoc.id,
    organizationId,
    isSuperAdmin,
    roleIds: access.roleIds,
    permissions: access.permissions,
    branchIds: access.branchIds,
    scope: access.scope,
    requestId,
    ip: identity.ip ?? null,
    userAgent: identity.userAgent ?? null,
  };
}
