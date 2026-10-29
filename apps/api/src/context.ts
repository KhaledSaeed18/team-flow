import type { Auth, Session } from '@teamflow/auth';
import type { Database } from '@teamflow/db';
import type { Clock } from '@teamflow/domain';
import type { Logger } from './logger.ts';

/** Long-lived dependencies, created once at startup. */
export interface Deps {
  db: Database;
  auth: Auth;
  clock: Clock;
  logger: Logger;
}

/** What every procedure receives. */
export interface RequestContext extends Deps {
  requestId: string;
  headers: Headers;
  session: Session | null;
}
