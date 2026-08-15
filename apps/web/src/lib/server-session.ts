import { cookies, headers } from 'next/headers';
import { resolveAccessContext, SESSION_COOKIE_NAME } from '@clinic/auth';
import type { AccessContext } from '@clinic/core';

/**
 * Builds the AccessContext inside a Server Component, so a page can load its
 * own data without a round trip through fetch.
 *
 * The context comes from the signed session cookie — a page can no more
 * fabricate one than an API caller can.
 */
export async function getServerContext(): Promise<AccessContext | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;

  try {
    return await resolveAccessContext({
      sessionCookie: session,
      ip: headerStore.get('x-forwarded-for'),
      userAgent: headerStore.get('user-agent'),
    });
  } catch {
    return null; // expired or revoked — middleware redirects to /login
  }
}

export function can(ctx: AccessContext | null, permission: string): boolean {
  if (!ctx) return false;
  return ctx.isSuperAdmin || ctx.permissions.has(permission);
}
