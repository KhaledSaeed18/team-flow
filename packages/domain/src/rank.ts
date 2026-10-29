/**
 * Fractional order keys for boards and backlogs (ADR-0008).
 *
 * A key is an "integer part" whose first character encodes its length, followed by an optional fractional part.
 * Keys compare correctly as plain strings under byte ordering (`collate "C"` in Postgres), so moving an item only
 * ever rewrites that item's key. Appending to either end grows keys logarithmically; inserting repeatedly into the
 * same gap grows them linearly, which is what `needsRebalance` watches for.
 *
 * The integer/fraction encoding follows David Greenspan's "Implementing Fractional Indexing".
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = '0';
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;

/** Keys longer than this make a column a candidate for rebalancing. */
export const REBALANCE_THRESHOLD = 32;

export type Rank = string;

export class InvalidRankError extends Error {
  override name = 'InvalidRankError';
}

const digitAt = (s: string, i: number): string => {
  const c = s[i];
  if (c === undefined) throw new InvalidRankError(`index ${i} out of range in "${s}"`);
  return c;
};

const digitValue = (digit: string): number => {
  const v = DIGITS.indexOf(digit);
  if (v === -1) throw new InvalidRankError(`invalid digit "${digit}"`);
  return v;
};

const digitOf = (value: number): string => digitAt(DIGITS, value);

function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 97 + 2;
  if (head >= 'A' && head <= 'Z') return 90 - head.charCodeAt(0) + 2;
  throw new InvalidRankError(`invalid head "${head}"`);
}

function integerPart(key: string): string {
  const length = integerLength(digitAt(key, 0));
  if (length > key.length) throw new InvalidRankError(`invalid key "${key}"`);
  return key.slice(0, length);
}

export function isValidRank(key: string): boolean {
  try {
    assertValidRank(key);
    return true;
  } catch {
    return false;
  }
}

export function assertValidRank(key: string): void {
  if (key === SMALLEST_INTEGER) throw new InvalidRankError(`invalid key "${key}"`);
  for (const c of key) digitValue(c);
  const fraction = key.slice(integerPart(key).length);
  if (fraction.endsWith(ZERO)) throw new InvalidRankError(`invalid key "${key}"`);
}

/** A key strictly between fractions `a` and `b` (`b === null` means "no upper bound"). */
function midpoint(a: string, b: string | null, random: () => number): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n), random);
  }
  const low = a.length > 0 ? digitValue(digitAt(a, 0)) : 0;
  const high = b !== null ? digitValue(digitAt(b, 0)) : DIGITS.length;
  if (high - low > 1) {
    // Any digit strictly between works; picking one at random spreads concurrent inserts apart.
    const span = high - low - 1;
    return digitOf(low + 1 + Math.min(span - 1, Math.floor(random() * span)));
  }
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return digitOf(low) + midpoint(a.slice(1), null, random);
}

function incrementInteger(x: string): string | null {
  const head = digitAt(x, 0);
  const digits = x.slice(1).split('');
  for (let i = digits.length - 1; i >= 0; i--) {
    const next = digitValue(digitAt(x, i + 1)) + 1;
    if (next < DIGITS.length) {
      digits[i] = digitOf(next);
      return head + digits.join('');
    }
    digits[i] = ZERO;
  }
  if (head === 'Z') return `a${ZERO}`;
  if (head === 'z') return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > 'a') digits.push(ZERO);
  else digits.pop();
  return nextHead + digits.join('');
}

function decrementInteger(x: string): string | null {
  const head = digitAt(x, 0);
  const digits = x.slice(1).split('');
  const top = digitOf(DIGITS.length - 1);
  for (let i = digits.length - 1; i >= 0; i--) {
    const prev = digitValue(digitAt(x, i + 1)) - 1;
    if (prev >= 0) {
      digits[i] = digitOf(prev);
      return head + digits.join('');
    }
    digits[i] = top;
  }
  if (head === 'a') return `Z${top}`;
  if (head === 'A') return null;
  const prevHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (prevHead < 'Z') digits.push(top);
  else digits.pop();
  return prevHead + digits.join('');
}

function exactKeyBetween(a: Rank | null, b: Rank | null, random: () => number): Rank {
  if (a !== null) assertValidRank(a);
  if (b !== null) assertValidRank(b);
  if (a !== null && b !== null && a >= b) {
    throw new InvalidRankError(`"${a}" is not before "${b}"`);
  }

  if (a === null) {
    if (b === null) return `a${ZERO}`;
    const ib = integerPart(b);
    const fb = b.slice(ib.length);
    if (ib === SMALLEST_INTEGER) return ib + midpoint('', fb, random);
    if (ib < b) return ib;
    const decremented = decrementInteger(ib);
    if (decremented === null) throw new InvalidRankError('cannot rank before the smallest key');
    return decremented;
  }

  const ia = integerPart(a);
  const fa = a.slice(ia.length);
  if (b === null) {
    return incrementInteger(ia) ?? ia + midpoint(fa, null, random);
  }

  const ib = integerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) return ia + midpoint(fa, fb, random);
  const incremented = incrementInteger(ia);
  if (incremented === null) throw new InvalidRankError('cannot rank after the largest key');
  return incremented < b ? incremented : ia + midpoint(fa, null, random);
}

export interface RankOptions {
  /**
   * Characters of random suffix appended so that two clients inserting into the same gap at the same moment
   * produce different keys. `0` gives deterministic keys (useful for seeds and tests).
   */
  jitter?: number;
  random?: () => number;
}

/**
 * A key strictly between `before` and `after`. `null` means "start" / "end" of the list.
 *
 * With jitter (the default), the key is first made not to be a prefix of `after`, so that any suffix keeps it below
 * `after`, and then gets a short random tail.
 */
export function rankBetween(
  before: Rank | null,
  after: Rank | null,
  { jitter = 3, random = Math.random }: RankOptions = {},
): Rank {
  let key = exactKeyBetween(before, after, random);
  if (jitter === 0) return key;

  while (after?.startsWith(key)) {
    key += midpoint('', after.slice(key.length), random);
  }
  for (let i = 0; i < jitter - 1; i++) key += digitOf(Math.floor(random() * DIGITS.length));
  // The last digit of a fraction must not be zero.
  key += digitOf(1 + Math.floor(random() * (DIGITS.length - 1)));
  return key;
}

/** `count` ascending keys strictly between `before` and `after`, evenly spread. */
export function ranksBetween(
  before: Rank | null,
  after: Rank | null,
  count: number,
  options: RankOptions = {},
): Rank[] {
  if (count <= 0) return [];
  if (count === 1) return [rankBetween(before, after, options)];
  if (after === null) {
    const keys: Rank[] = [];
    let previous = before;
    for (let i = 0; i < count; i++) {
      previous = rankBetween(previous, null, { ...options, jitter: 0 });
      keys.push(previous);
    }
    return keys;
  }
  if (before === null) {
    const keys: Rank[] = [];
    let next = after;
    for (let i = 0; i < count; i++) {
      next = rankBetween(null, next, { ...options, jitter: 0 });
      keys.push(next);
    }
    return keys.reverse();
  }
  const middleIndex = Math.floor(count / 2);
  const middle = rankBetween(before, after, { ...options, jitter: 0 });
  return [
    ...ranksBetween(before, middle, middleIndex, { ...options, jitter: 0 }),
    middle,
    ...ranksBetween(middle, after, count - middleIndex - 1, { ...options, jitter: 0 }),
  ];
}

export const compareRanks = (a: Rank, b: Rank): number => (a < b ? -1 : a > b ? 1 : 0);

export const needsRebalance = (ranks: readonly Rank[]): boolean =>
  ranks.some((rank) => rank.length > REBALANCE_THRESHOLD);
