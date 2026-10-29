import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import {
  assertValidRank,
  InvalidRankError,
  isValidRank,
  needsRebalance,
  rankBetween,
  ranksBetween,
} from './rank.ts';

const exact = { jitter: 0 } as const;

describe('rankBetween', () => {
  test('first key of an empty list', () => {
    expect(rankBetween(null, null, exact)).toBe('a0');
  });

  test('appending and prepending move the integer part', () => {
    expect(rankBetween('a0', null, exact)).toBe('a1');
    expect(rankBetween('az', null, exact)).toBe('b00');
    expect(rankBetween(null, 'a0', exact)).toBe('Zz');
    expect(rankBetween(null, 'b00', exact)).toBe('az');
  });

  test('inserting between neighbours uses the fraction', () => {
    const key = rankBetween('a0', 'a1', exact);
    expect(key > 'a0' && key < 'a1').toBe(true);
    expect(key.startsWith('a0')).toBe(true);
  });

  test('rejects reversed or equal bounds', () => {
    expect(() => rankBetween('a1', 'a0')).toThrow(InvalidRankError);
    expect(() => rankBetween('a1', 'a1')).toThrow(InvalidRankError);
  });

  test('rejects malformed keys', () => {
    expect(isValidRank('a10')).toBe(false); // trailing zero in the fraction
    expect(isValidRank('b0')).toBe(false); // integer part too short
    expect(isValidRank('a!')).toBe(false);
    expect(() => assertValidRank('a0')).not.toThrow();
  });

  test('jitter separates concurrent inserts into the same gap', () => {
    const keys = new Set(Array.from({ length: 200 }, () => rankBetween('a0', 'a1')));
    expect(keys.size).toBeGreaterThan(190);
    for (const key of keys) {
      expect(key > 'a0' && key < 'a1').toBe(true);
      expect(isValidRank(key)).toBe(true);
    }
  });

  test('jitter never escapes an upper bound it is a prefix of', () => {
    // The exact key between null and "a0V" is "a0", a prefix of the bound.
    for (let i = 0; i < 100; i++) {
      const key = rankBetween(null, 'a0V');
      expect(key < 'a0V').toBe(true);
      expect(isValidRank(key)).toBe(true);
    }
  });

  test('appending to the end grows keys slowly', () => {
    let key: string | null = null;
    for (let i = 0; i < 10_000; i++) key = rankBetween(key, null, exact);
    expect(key?.length).toBeLessThanOrEqual(5);
  });
});

describe('ranksBetween', () => {
  test('produces ascending keys inside the bounds', () => {
    for (const [a, b] of [
      [null, null],
      ['a0', null],
      [null, 'a0'],
      ['a0', 'a1'],
    ] as const) {
      const keys = ranksBetween(a, b, 25);
      expect(keys).toHaveLength(25);
      expect([...keys].sort()).toEqual(keys);
      expect(new Set(keys).size).toBe(25);
      for (const key of keys) {
        expect(a === null || key > a).toBe(true);
        expect(b === null || key < b).toBe(true);
      }
    }
  });
});

describe('properties', () => {
  // A random sequence of insert positions applied to an initially empty list.
  const operations = fc.array(fc.tuple(fc.nat(), fc.boolean()), { minLength: 1, maxLength: 300 });

  test('any sequence of inserts keeps the list strictly ordered and every key valid', () => {
    fc.assert(
      fc.property(operations, (ops) => {
        const list: string[] = [];
        for (const [position, jittered] of ops) {
          const index = position % (list.length + 1);
          const key = rankBetween(list[index - 1] ?? null, list[index] ?? null, {
            jitter: jittered ? 3 : 0,
          });
          list.splice(index, 0, key);
        }
        for (let i = 1; i < list.length; i++) {
          if (!((list[i - 1] as string) < (list[i] as string))) return false;
        }
        return list.every(isValidRank);
      }),
      { numRuns: 300 },
    );
  });

  test('a key placed between two keys sorts between them under byte order', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 40 }), fc.nat(), (size, seed) => {
        const list = ranksBetween(null, null, size);
        const i = seed % (size - 1);
        const a = list[i] as string;
        const b = list[i + 1] as string;
        const key = rankBetween(a, b);
        return (
          Buffer.compare(Buffer.from(a), Buffer.from(key)) < 0 &&
          Buffer.compare(Buffer.from(key), Buffer.from(b)) < 0
        );
      }),
    );
  });
});

describe('needsRebalance', () => {
  test('flags lists with overlong keys', () => {
    expect(needsRebalance(['a0', 'a1'])).toBe(false);
    let low = 'a0';
    const high = 'a1';
    for (let i = 0; i < 200; i++) low = rankBetween(low, high, exact);
    expect(needsRebalance([low, high])).toBe(true);
  });
});
