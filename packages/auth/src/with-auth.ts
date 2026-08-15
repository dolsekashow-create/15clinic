import { AppError, ErrorCode, hasPermission, isAppError, type AccessContext } from '@clinic/core';
import { logger } from '@clinic/infra';
import { resolveAccessContext } from './resolve-access-context.js';

export interface GuardOptions {
  /** Permission key required to enter the handler. */
  permission?: string;
  /** Additional permission keys, any of which is sufficient. */
  anyOf?: string[];
}

export type AuthedHandler = (req: Request, ctx: AccessContext) => Promise<Response>;

const SESSION_COOKIE_NAME = 'clinic_session';

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Wraps an API route handler with authentication, authorisation and the
 * unified error envelope. Authorisation lives here — on the server — and the
 * frontend hiding a button is treated as cosmetics, never as a control.
 */
export function withAuth(handler: AuthedHandler, options: GuardOptions = {}) {
  return async (req: Request): Promise<Response> => {
    try {
      const ctx = await resolveAccessContext({
        sessionCookie: readCookie(req, SESSION_COOKIE_NAME),
        bearerToken: req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null,
        ip: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      });

      if (options.permission && !hasPermission(ctx, options.permission)) {
        throw AppError.forbidden({ required: options.permission });
      }
      if (options.anyOf && !options.anyOf.some((p) => hasPermission(ctx, p))) {
        throw AppError.forbidden({ requiredAnyOf: options.anyOf });
      }

      return await handler(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function toErrorResponse(err: unknown): Response {
  if (isAppError(err)) {
    // details stay in the log; the client only ever sees code + safe message.
    if (err.httpStatus >= 500) logger.error(err.code, { details: err.details });
    return Response.json(
      { error: { code: err.code, message: err.safeMessage } },
      { status: err.httpStatus },
    );
  }

  logger.error('unhandled_error', { error: String(err) });
  return Response.json(
    { error: { code: ErrorCode.INTERNAL, message: 'حدث خطأ غير متوقع، تم تسجيل المشكلة' } },
    { status: 500 },
  );
}

export { SESSION_COOKIE_NAME };
