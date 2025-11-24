// Source: centralized error helpers for API routes
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'DATABASE_ERROR'
  | 'CONFLICT'
  | 'UNKNOWN';

export interface AppError extends Error {
  code: AppErrorCode;
  httpStatus: number;
  details?: unknown;
}

export function createError(
  code: AppErrorCode,
  message: string,
  httpStatus = 400,
  details?: unknown
): AppError {
  const err = new Error(message) as AppError;
  err.code = code;
  err.httpStatus = httpStatus;
  err.details = details;
  return err;
}

export function formatErrorResponse(err: unknown) {
  if (typeof err === 'object' && err && 'httpStatus' in err && 'code' in err) {
    const e = err as AppError;
    return new Response(
      JSON.stringify({ ok: false, code: e.code, message: e.message, details: e.details }),
      { status: e.httpStatus, headers: { 'content-type': 'application/json' } }
    );
  }
  return new Response(
    JSON.stringify({ ok: false, code: 'UNKNOWN', message: 'Server error' }),
    { status: 500, headers: { 'content-type': 'application/json' } }
  );
}

