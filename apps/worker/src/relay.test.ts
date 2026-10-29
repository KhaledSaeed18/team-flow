import { describe, expect, test } from 'bun:test';
import { createRelayLoop } from './relay.ts';

describe('relay loop', () => {
  test('drains until empty', async () => {
    const batches = [3, 3, 1, 0];
    const loop = createRelayLoop(
      async () => batches.shift() ?? 0,
      () => {},
    );
    await loop.run();
    expect(batches).toEqual([]);
  });

  test('a wake during a drain runs one more pass instead of a parallel one', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    let passes = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loop = createRelayLoop(
      async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        passes++;
        if (passes === 1) await gate;
        concurrent--;
        return 0;
      },
      () => {},
    );

    const first = loop.run();
    loop.wake();
    loop.wake();
    release();
    await first;
    expect(maxConcurrent).toBe(1);
    expect(passes).toBe(2);
  });

  test('reports errors and recovers on the next wake', async () => {
    const errors: unknown[] = [];
    let fail = true;
    const loop = createRelayLoop(
      async () => {
        if (fail) {
          fail = false;
          throw new Error('db down');
        }
        return 0;
      },
      (e) => errors.push(e),
    );
    await loop.run();
    await loop.run();
    expect(errors).toHaveLength(1);
  });

  test('run joins a drain in progress and resolves only when it has finished (shutdown waits for it)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let finished = false;
    let passes = 0;
    const loop = createRelayLoop(
      async () => {
        passes++;
        if (passes === 1) await gate;
        if (passes === 2) finished = true;
        return 0;
      },
      () => {},
    );
    loop.wake();
    let joined = false;
    const waiting = loop.run().then(() => {
      joined = true;
    });
    await Promise.resolve();
    expect(joined).toBe(false);
    release();
    await waiting;
    expect(finished).toBe(true);
  });
});
