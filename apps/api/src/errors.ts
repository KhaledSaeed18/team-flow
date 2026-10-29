import { ORPCError } from '@orpc/server';
import { StaleWriteError } from '@teamflow/db';

/**
 * Services throw these instead of transport errors, so they stay usable from jobs and tests. A middleware turns
 * them into the contract's typed errors.
 */
export type AppErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'KEY_TAKEN' | 'BAD_REQUEST';

const STATUS: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  KEY_TAKEN: 409,
};

export class AppError extends Error {
  override name = 'AppError';
  constructor(
    readonly code: AppErrorCode,
    message?: string,
    readonly data?: Record<string, unknown>,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what = 'Not found.') => new AppError('NOT_FOUND', what);
export const forbidden = () => new AppError('FORBIDDEN', 'You do not have permission to do that.');

export function toTransportError(error: unknown): unknown {
  if (error instanceof StaleWriteError) {
    return new ORPCError('CONFLICT', {
      message: 'This was changed by someone else. Reload and try again.',
      data: { currentVersion: error.currentVersion },
    });
  }
  if (error instanceof AppError) {
    return new ORPCError<AppErrorCode, Record<string, unknown> | undefined>(error.code, {
      status: STATUS[error.code],
      message: error.message,
      data: error.data,
    });
  }
  return error;
}
