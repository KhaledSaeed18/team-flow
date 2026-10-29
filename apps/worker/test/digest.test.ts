import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createScope, newId, setDigestFrequency } from '@teamflow/db';
import { members, notifications, organizations, users } from '@teamflow/db/schema';
import { createTestDatabase, type TestDatabase } from '@teamflow/db/testing';
import type { EmailMessage } from '@teamflow/email';
import { runDigests } from '../src/digest.ts';

const HOUR = 60 * 60 * 1000;

describe('runDigests', () => {
  let t: TestDatabase;
  const org = newId();
  const people = { ada: newId(), linus: newId(), grace: newId() };
  const memberIds = { ada: newId(), linus: newId(), grace: newId() };

  const notify = (
    recipient: string,
    at: Date,
    extra: Partial<typeof notifications.$inferInsert> = {},
  ) =>
    t.db.insert(notifications).values({
      organizationId: org,
      recipientMemberId: recipient,
      actorMemberId: memberIds.linus,
      kind: 'mentioned',
      data: { identifier: 'RF-12', title: 'Lidar driver timeouts', excerpt: 'Retry?' },
      createdAt: at,
      ...extra,
    });

  const run = async (now: Date) => {
    const sent: EmailMessage[] = [];
    const count = await runDigests({ db: t.db, now, enqueue: async (m) => sent.push(m) });
    expect(count).toBe(sent.length);
    return sent;
  };

  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.insert(organizations).values({ id: org, name: 'Northwind', slug: 'northwind' });
    for (const who of ['ada', 'linus', 'grace'] as const) {
      await t.db.insert(users).values({
        id: people[who],
        name: who === 'ada' ? 'Ada Lovelace' : who,
        email: `${who}@example.com`,
      });
      await t.db
        .insert(members)
        .values({ id: memberIds[who], organizationId: org, userId: people[who], role: 'member' });
    }
  });
  afterAll(() => t.destroy());

  test('sends one digest per person with unread items, then waits a day', async () => {
    const now = new Date('2026-03-10T09:00:00Z');
    await notify(memberIds.ada, new Date(now.getTime() - 2 * HOUR));
    await notify(memberIds.ada, new Date(now.getTime() - HOUR), {
      kind: 'assigned',
      data: { identifier: 'FC-3', title: 'Fleet map' },
    });
    // Read already, and too old: neither earns Linus a digest.
    await notify(memberIds.linus, new Date(now.getTime() - HOUR), { readAt: now });
    await notify(memberIds.linus, new Date(now.getTime() - 9 * 24 * HOUR));

    const [digest, ...others] = await run(now);
    expect(others).toEqual([]);
    expect(digest).toMatchObject({
      kind: 'digest',
      to: 'ada@example.com',
      name: 'Ada Lovelace',
      organizationName: 'Northwind',
      frequency: 'daily',
      more: 0,
      items: [
        { kind: 'assigned', actorName: 'linus', identifier: 'FC-3', title: 'Fleet map' },
        { kind: 'mentioned', identifier: 'RF-12', excerpt: 'Retry?' },
      ],
    });

    // Something new an hour later still waits for tomorrow, and only the new item goes then.
    await notify(memberIds.ada, new Date(now.getTime() + HOUR), {
      data: { identifier: 'RF-13', title: 'Encoder drift' },
    });
    expect(await run(new Date(now.getTime() + 2 * HOUR))).toEqual([]);
    const [tomorrow] = await run(new Date(now.getTime() + 24 * HOUR));
    expect(tomorrow?.kind === 'digest' && tomorrow.items.map((i) => i.identifier)).toEqual([
      'RF-13',
    ]);
  });

  test('respects off and weekly, and caps the list', async () => {
    const now = new Date('2026-03-20T09:00:00Z');
    const scope = createScope(t.db, org, memberIds.grace);
    await setDigestFrequency(scope, memberIds.grace, 'off');
    await notify(memberIds.grace, new Date(now.getTime() - HOUR));
    expect((await run(now)).map((m) => m.to)).not.toContain('grace@example.com');

    await setDigestFrequency(scope, memberIds.grace, 'weekly');
    for (let i = 0; i < 12; i++)
      await notify(memberIds.grace, new Date(now.getTime() - (i + 2) * HOUR));
    const weekly = (await run(now)).find((m) => m.to === 'grace@example.com');
    expect(weekly).toMatchObject({ frequency: 'weekly', more: 3 });
    expect(weekly?.kind === 'digest' && weekly.items).toHaveLength(10);

    await notify(memberIds.grace, new Date(now.getTime() + HOUR));
    expect((await run(new Date(now.getTime() + 3 * 24 * HOUR))).map((m) => m.to)).not.toContain(
      'grace@example.com',
    );
    expect((await run(new Date(now.getTime() + 7 * 24 * HOUR))).map((m) => m.to)).toContain(
      'grace@example.com',
    );
  });
});
