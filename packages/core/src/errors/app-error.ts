import { ERROR_MESSAGES_AR, ErrorCode, type ErrorCodeValue } from './codes.js';

/**
 * The only error type crossing a service boundary.
 * `details` is for logs only and is never serialised to the client.
 */
export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly httpStatus: number;
  readonly safeMessage: string;
  readonly details?: unknown;

  constructor(code: ErrorCodeValue, httpStatus: number, details?: unknown, safeMessage?: string) {
    super(safeMessage ?? ERROR_MESSAGES_AR[code]);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.safeMessage = safeMessage ?? ERROR_MESSAGES_AR[code];
    this.details = details;
  }

  static unauthenticated(details?: unknown) {
    return new AppError(ErrorCode.UNAUTHENTICATED, 401, details);
  }
  static forbidden(details?: unknown) {
    return new AppError(ErrorCode.FORBIDDEN, 403, details);
  }
  static branchForbidden(branchId: string) {
    return new AppError(ErrorCode.FORBIDDEN_BRANCH_ACCESS, 403, { branchId });
  }
  static notFound(entity: string, id?: string) {
    return new AppError(ErrorCode.NOT_FOUND, 404, { entity, id });
  }
  static validation(details?: unknown) {
    return new AppError(ErrorCode.VALIDATION_FAILED, 422, details);
  }
  static conflict(code: ErrorCodeValue = ErrorCode.CONFLICT, details?: unknown) {
    return new AppError(code, 409, details);
  }
  static internal(details?: unknown) {
    return new AppError(ErrorCode.INTERNAL, 500, details);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
