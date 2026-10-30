/** Raised when an update carries a `version` that is no longer current. */
export class StaleWriteError extends Error {
  override name = 'StaleWriteError';
  constructor(readonly currentVersion: number) {
    super(`stale write; current version is ${currentVersion}`);
  }
}

/** A Postgres unique violation, with the constraint that fired. */
export function uniqueViolation(error: unknown): string | null {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string };
  return pg?.code === '23505' ? (pg.constraint_name ?? 'unknown') : null;
}

/** A Postgres foreign-key violation, with the constraint that fired. */
export function foreignKeyViolation(error: unknown): string | null {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string };
  return pg?.code === '23503' ? (pg.constraint_name ?? 'unknown') : null;
}

/** A Postgres check-constraint violation, with the constraint that fired. */
export function checkViolation(error: unknown): string | null {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string };
  return pg?.code === '23514' ? (pg.constraint_name ?? 'unknown') : null;
}

/** Postgres gave up on a transaction to break a deadlock (`40P01`) or a serialization conflict (`40001`). */
export function concurrencyFailure(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const code = (cause as { code?: string })?.code;
  return code === '40P01' || code === '40001';
}

/** A sprint is in the wrong state for the change (completed sprints are closed, …). */
export class SprintStateError extends Error {
  override name = 'SprintStateError';
}
