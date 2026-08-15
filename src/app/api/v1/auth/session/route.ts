import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, ErrorCode } from '@/server/core';
import { SESSION_COOKIE_NAME, toErrorResponse } from '@/server/auth';
import { getAdminAuth } from '@/server/infra';

// Firebase Admin needs the Node runtime; it does not run on the Edge runtime.
export const runtime = 'nodejs';

const bodySchema = z.object({ idToken: z.string().min(20) });

/**
 * Exchanges a Firebase id token for an httpOnly session cookie.
 * The token never touches localStorage, so an XSS bug cannot steal the session.
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(parsed.data.idToken, true);

    // Reject tokens older than 5 minutes: a session cookie must come from a
    // fresh sign-in, not a token replayed later.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      throw new AppError(ErrorCode.SESSION_EXPIRED, 401, { reason: 'stale id token' });
    }

    const days = Number(process.env.SESSION_EXPIRES_DAYS ?? 5);
    const expiresIn = days * 24 * 60 * 60 * 1000;
    const sessionCookie = await auth.createSessionCookie(parsed.data.idToken, { expiresIn });

    const res = NextResponse.json({ data: { ok: true } });
    res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn / 1000,
    });
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
