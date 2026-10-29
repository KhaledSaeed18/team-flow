/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { lenient } from './search.ts';

describe('lenient search params', () => {
  const validate = lenient(
    z.object({
      q: z.string().max(5).optional(),
      assignee: z.array(z.string()).optional(),
      closed: z.boolean().optional(),
    }),
  );

  test('keeps valid keys and drops only the invalid ones', () => {
    expect(validate({ q: 'way too long', assignee: 'me', closed: true })).toEqual({ closed: true });
    expect(validate({ q: 'ok', assignee: ['me'], extra: 1 })).toEqual({
      q: 'ok',
      assignee: ['me'],
    });
    expect(validate({})).toEqual({});
  });
});
