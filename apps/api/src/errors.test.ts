import { describe, expect, test } from 'bun:test';
import { ORPCError } from '@orpc/server';
import { toTransportError } from './errors.ts';

describe('error mapping', () => {
  test('a transaction aborted to break a deadlock is a conflict, not a server error', () => {
    for (const code of ['40P01', '40001']) {
      const mapped = toTransportError(
        Object.assign(new Error('query failed'), { cause: { code } }),
      );
      expect(mapped).toBeInstanceOf(ORPCError);
      expect((mapped as ORPCError<string, unknown>).code).toBe('CONFLICT');
    }
  });
});
