import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

const DAY = 86_400_000;

/** Edge cases that used to answer with a server error, a lost update or a broken order. */
describe('robustness', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  let projectId: string;
  const status = async (name: string) => {
    const project = await ada.client.projects.get({ id: projectId });
    const found = project.statuses.find((s) => s.name === name);
    if (!found) throw new Error(`no status ${name}`);
    return found;
  };

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    projectId = (await ada.client.projects.create({ key: 'ROB', name: 'Robust' })).id;
  });
  afterAll(() => h.destroy());

  test('saving a project unchanged keeps its version, so nobody else gets a conflict', async () => {
    const project = await ada.client.projects.get({ id: projectId });
    const same = await ada.client.projects.update({
      id: projectId,
      version: project.version,
      name: project.name,
    });
    expect(same.version).toBe(project.version);
    await ada.client.projects.update({ id: projectId, version: project.version, name: 'Robust 2' });
  });

  test('a sprint cannot be edited to end before it starts', async () => {
    const start = h.clock.now();
    const sprint = await ada.client.sprints.create({
      projectId,
      name: 'S1',
      startsAt: start,
      endsAt: new Date(start.getTime() + 7 * DAY),
    });
    await expect(
      ada.client.sprints.update({
        id: sprint.id,
        version: sprint.version,
        endsAt: new Date(start.getTime() - DAY),
      }),
    ).rejects.toMatchObject({ code: 'SPRINT_STATE' });
  });

  test('retrying a create with the same id returns the same task; a taken id is a conflict', async () => {
    const id = crypto.randomUUID();
    const first = await ada.client.tasks.create({ id, projectId, title: 'Once' });
    const again = await ada.client.tasks.create({ id, projectId, title: 'Once' });
    expect(again.id).toBe(first.id);
    expect((await ada.client.tasks.list({ projectId })).filter((t) => t.id === id)).toHaveLength(1);

    const other = await ada.client.projects.create({ key: 'OTH', name: 'Other' });
    await expect(
      ada.client.tasks.create({ id, projectId: other.id, title: 'Clash' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('uploading to something that is not a task id is a 404', async () => {
    const response = await ada.fetch('/api/tasks/not-a-uuid/attachments?name=x.txt', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'x',
    });
    expect(response.status).toBe(404);
  });

  test('concurrent links: repeats return one relation, and a two-way block is refused', async () => {
    const [a, b] = await Promise.all([
      ada.client.tasks.create({ projectId, title: 'A' }),
      ada.client.tasks.create({ projectId, title: 'B' }),
    ]);
    const same = await Promise.all(
      [1, 2, 3].map(() =>
        ada.client.relations.add({ taskId: a.id, kind: 'relates', otherTaskId: b.id }),
      ),
    );
    expect(new Set(same.map((r) => r.id)).size).toBe(1);

    const results = await Promise.allSettled([
      ada.client.relations.add({ taskId: a.id, kind: 'blocks', otherTaskId: b.id }),
      ada.client.relations.add({ taskId: b.id, kind: 'blocks', otherTaskId: a.id }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'INVALID_REFERENCE' },
    });
  });

  test('deleting a status puts its tasks below the target column, in order, with distinct ranks', async () => {
    const review = await status('In Review');
    const progress = await status('In Progress');
    const resident = await ada.client.tasks.create({
      projectId,
      title: 'Already in progress',
      statusId: progress.id,
    });
    const first = await ada.client.tasks.create({ projectId, title: 'R1', statusId: review.id });
    const second = await ada.client.tasks.create({ projectId, title: 'R2', statusId: review.id });

    await ada.client.workflow.deleteStatus({ id: review.id, moveTasksTo: progress.id });
    const column = (await ada.client.tasks.list({ projectId }))
      .filter((t) => t.statusId === progress.id)
      .sort((x, y) => (x.rank < y.rank ? -1 : 1))
      .map((t) => t.id);
    expect(column.slice(-3)).toEqual([resident.id, first.id, second.id]);
  });

  test('cancelling an invitation records it in that invitation’s workspace, not the active one', async () => {
    const other = await ada.authPost('/organization/create', { name: 'Side', slug: 'ada-side' });
    const invitation = await ada.authPost('/organization/invite-member', {
      email: 'guest@example.com',
      role: 'member',
      organizationId: other.id,
    });
    // Creating a workspace makes it active; switch back so the invitation is in a workspace that is not.
    await ada.authPost('/organization/set-active', { organizationId: ada.organizationId });
    await ada.authPost('/organization/cancel-invitation', { invitationId: invitation.id });

    const active = await ada.client.audit.list();
    expect(active.entries.map((e) => e.kind)).not.toContain('invitation.canceled');
    await ada.authPost('/organization/set-active', { organizationId: other.id });
    const side = await ada.client.audit.list();
    expect(side.entries[0]).toMatchObject({
      kind: 'invitation.canceled',
      changes: [{ field: 'email', from: 'guest@example.com' }],
    });
  });
});
