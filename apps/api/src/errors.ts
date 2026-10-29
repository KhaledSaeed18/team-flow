import { ORPCError } from '@orpc/server';
import {
  checkViolation,
  foreignKeyViolation,
  InvalidReferenceError,
  InvalidWorkflowError,
  SprintStateError,
  StaleWriteError,
} from '@teamflow/db';

/**
 * Services throw these instead of transport errors, so they stay usable from jobs and tests. A middleware turns
 * them into the contract's typed errors.
 */
export type AppErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'KEY_TAKEN'
  | 'BAD_REQUEST'
  | 'INVALID_REFERENCE'
  | 'INVALID_WORKFLOW'
  | 'NAME_TAKEN'
  | 'SPRINT_STATE';

const STATUS: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  KEY_TAKEN: 409,
  INVALID_REFERENCE: 422,
  INVALID_WORKFLOW: 422,
  NAME_TAKEN: 409,
  SPRINT_STATE: 409,
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
  if (error instanceof InvalidReferenceError) {
    return new ORPCError('INVALID_REFERENCE', { status: 422, message: error.message });
  }
  if (error instanceof SprintStateError) {
    return new ORPCError('SPRINT_STATE', { status: 409, message: error.message });
  }
  if (error instanceof InvalidWorkflowError) {
    return new ORPCError('INVALID_WORKFLOW', { status: 422, message: error.message });
  }
  if (foreignKeyViolation(error)) {
    return new ORPCError('INVALID_REFERENCE', {
      status: 422,
      message: 'Something this refers to does not exist in this organization.',
    });
  }
  // Input the schema let through but the database refuses (a CHECK constraint) is still the caller's mistake.
  if (checkViolation(error)) {
    return new ORPCError('BAD_REQUEST', {
      status: 400,
      message: 'Those values do not fit together. Check them and try again.',
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
