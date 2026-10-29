import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { newId } from '../ids.ts';
import { members, organizations, users } from '../schema/auth.ts';
import { createScope, type Scope } from '../scope.ts';
import { createTestDatabase, type TestDatabase } from '../testing.ts';
import { createProject } from './projects.ts';
import { prefixQuery, searchTasks } from './search.ts';
import { createTask } from './tasks.ts';

describe('task search', () => {
  let t: TestDatabase;
  let scope: Scope;
  let other: Scope;

  const tenant = async (slug: string) => {
    const organizationId = newId();
    const userId = newId();
    const memberId = newId();
    await t.db.insert(users).values({ id: userId, name: slug, email: `${slug}@example.com` });
    await t.db.insert(organizations).values({ id: organizationId, name: slug, slug });
    await t.db.insert(members).values({ id: memberId, organizationId, userId, role: 'owner' });
    return createScope(t.db, organizationId, memberId);
  };

  beforeAll(async () => {
    t = await createTestDatabase();
    scope = await tenant('acme');
    other = await tenant('globex');
    const { project } = await createProject(scope, { key: 'RF', name: 'Rover firmware' });
    const now = new Date();
    for (const [title, description] of [
      ['Calibrate wheel encoders', 'Encoder drift after long runs'],
      ['Battery telemetry over CAN', 'Publish pack voltage at 10 Hz'],
      ['Watchdog resets on brownout', 'Happens when the battery sags'],
    ] as const) {
      await createTask(scope, { projectId: project.id, title, description }, now);
    }
    const { project: theirs } = await createProject(other, { key: 'RF', name: 'Theirs' });
    await createTask(other, { projectId: theirs.id, title: 'Calibrate wheel encoders' }, now);
  });
  afterAll(() => t.destroy());

  const titles = async (q: string, s = scope) => (await searchTasks(s, q)).map((h) => h.title);

  test('matches word prefixes while typing', async () => {
    expect(await titles('calib enc')).toEqual(['Calibrate wheel encoders']);
    expect(await titles('teleme')).toEqual(['Battery telemetry over CAN']);
  });

  test('ranks a title match above a description match', async () => {
    expect(await titles('battery')).toEqual([
      'Battery telemetry over CAN',
      'Watchdog resets on brownout',
    ]);
  });

  test('tolerates typos in titles', async () => {
    expect(await titles('wachdog')).toEqual(['Watchdog resets on brownout']);
  });

  test('an exact identifier comes first', async () => {
    const [first] = await searchTasks(scope, 'rf-2');
    expect(first).toMatchObject({ number: 2, project_key: 'RF' });
  });

  test('never returns another organization’s tasks', async () => {
    expect(await titles('calibrate')).toHaveLength(1);
    expect((await searchTasks(other, 'battery')).length).toBe(0);
  });

  test('builds safe prefix queries', () => {
    expect(prefixQuery("calib & enc' | !x")).toBe('calib:* & enc:* & x:*');
    expect(prefixQuery('  ')).toBeNull();
  });
});
