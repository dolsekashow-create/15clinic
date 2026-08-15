import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware does a CHEAP check only: is a session cookie present?
 * It cannot verify the cookie (Firebase Admin does not run on the Edge runtime)
 * and it must not be treated as authorisation. Every API route re-verifies the
 * session and the permission on the server. This exists purely so a logged-out
 * visitor gets a redirect instead of a flash of empty dashboard.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(process.env.SESSION_COOKIE_NAME ?? 'clinic_session');

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
