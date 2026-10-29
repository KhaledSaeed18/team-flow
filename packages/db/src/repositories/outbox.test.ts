import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { isNull } from 'drizzle-orm';
import { newId } from '../ids.ts';
import { organizations } from '../schema/auth.ts';
import { outbox } from '../schema/tasks.ts';
import { createTestDatabase, type TestDatabase } from '../testing.ts';
import { OUTBOX_WAKE_CHANNEL, pruneOutbox, relayOutbox } from './outbox.ts';

const CHANNEL = 'teamflow_events_test';

/** Collect notifications until `count` arrive. */
function collect(t: TestDatabase, channel: string, count: number) {
  const received: string[] = [];
  let done: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    done = resolve;
  });
  const listening = t.sql.listen(channel, (payload) => {
    received.push(payload);
    if (received.length >= count) done();
  });
  return { received, listening, finished };
}

describe('outbox relay', () => {
  let t: TestDatabase;
  const organizationId = newId();

  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.insert(organizations).values({ id: organizationId, name: 'Org', slug: 'org' });
  });
  afterAll(() => t.destroy());

  const write = (n: number) =>
    t.db
      .insert(outbox)
      .values(
        Array.from({ length: n }, (_, i) => ({
          organizationId,
          topic: 'task.updated',
          payload: { seq: i },
        })),
      )
      .returning({ id: outbox.id });

  test('publishes pending events in creation order and marks them', async () => {
    const written = await write(5);
    const { received, listening, finished } = collect(t, CHANNEL, 5);
    await listening;

    expect(await relayOutbox(t.db, { channel: CHANNEL })).toBe(5);
    await finished;

    const messages = received.map((r) => JSON.parse(r));
    expect(messages.map((m) => m.id)).toEqual(written.map((w) => w.id));
    expect(messages[0]).toMatchObject({
      organizationId,
      topic: 'task.updated',
      payload: { seq: 0 },
    });
    expect(await t.db.select().from(outbox).where(isNull(outbox.publishedAt))).toHaveLength(0);
    expect(await relayOutbox(t.db, { channel: CHANNEL })).toBe(0);
  });

  test('concurrent relays never publish an event twice', async () => {
    await write(300);
    const counts = await Promise.all(
      Array.from({ length: 4 }, () => relayOutbox(t.db, { channel: CHANNEL, batchSize: 50 })),
    );
    let total = counts.reduce((a, b) => a + b, 0);
    while (true) {
      const more = await relayOutbox(t.db, { channel: CHANNEL, batchSize: 50 });
      if (more === 0) break;
      total += more;
    }
    expect(total).toBe(300);
  });

  test('writing an event wakes the relay through the insert trigger', async () => {
    const { received, listening, finished } = collect(t, OUTBOX_WAKE_CHANNEL, 1);
    await listening;
    await write(3);
    await finished;
    expect(received).toEqual(['']);
  });

  test('prunes only published events older than the retention window', async () => {
    await t.db.update(outbox).set({ publishedAt: new Date(Date.now() - 10 * 86_400_000) });
    await write(1);
    expect(await pruneOutbox(t.db, 7)).toBeGreaterThan(0);
    expect(await t.db.select().from(outbox)).toHaveLength(1);
  });
});
