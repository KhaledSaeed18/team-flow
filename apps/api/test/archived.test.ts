import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

const DAY = 86_400_000;

/** An archived project can be read and restored, and nothing in it can be changed. */
describe('archived projects are read-only', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  const ids = {} as {
    project: string;
    task: string;
    other: string;
    sprint: number;
    sprintId: string;
    label: string;
    status: string;
    moveTo: string;
    comment: string;
  };

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    const project = await ada.client.projects.create({ key: 'ARC', name: 'Archive me' });
    const full = await ada.client.projects.get({ id: project.id });
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'One' });
    const other = await ada.client.tasks.create({ projectId: project.id, title: 'Two' });
    const start = h.clock.now();
    const sprint = await ada.client.sprints.create({
      projectId: project.id,
      name: 'S1',
      startsAt: start,
      endsAt: new Date(start.getTime() + 7 * DAY),
    });
    const label = await ada.client.labels.create({
      projectId: project.id,
      name: 'Bug',
      color: '#c2412d',
    });
    const comment = await ada.client.comments.create({ taskId: task.id, body: 'Before' });
    Object.assign(ids, {
      project: project.id,
      task: task.id,
      other: other.id,
      sprint: sprint.version,
      sprintId: sprint.id,
      label: label.id,
      status: full.statuses[0]?.id,
      moveTo: full.statuses[1]?.id,
      comment: comment.id,
    });
    await ada.client.projects.archive({ id: project.id, version: project.version });
  });
  afterAll(() => h.destroy());

  const refused = (call: Promise<unknown>) =>
    expect(call).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'This project is archived.' });

  test('sprints', async () => {
    const start = h.clock.now();
    await refused(
      ada.client.sprints.create({
        projectId: ids.project,
        name: 'S2',
        startsAt: start,
        endsAt: new Date(start.getTime() + DAY),
      }),
    );
    await refused(ada.client.sprints.update({ id: ids.sprintId, version: ids.sprint, name: 'X' }));
    await refused(ada.client.sprints.start({ id: ids.sprintId, version: ids.sprint }));
  });

  test('labels and the workflow', async () => {
    await refused(
      ada.client.labels.create({ projectId: ids.project, name: 'New', color: '#000000' }),
    );
    await refused(ada.client.labels.update({ id: ids.label, name: 'Renamed' }));
    await refused(ada.client.labels.delete({ id: ids.label }));
    await refused(
      ada.client.workflow.createStatus({
        projectId: ids.project,
        name: 'QA',
        category: 'started',
        color: '#64748b',
      }),
    );
    await refused(ada.client.workflow.updateStatus({ id: ids.status, name: 'Renamed' }));
    await refused(ada.client.workflow.deleteStatus({ id: ids.status, moveTasksTo: ids.moveTo }));
  });

  test('comments, reactions and relations', async () => {
    await refused(ada.client.comments.create({ taskId: ids.task, body: 'After' }));
    await refused(ada.client.comments.update({ id: ids.comment, body: 'Edited' }));
    await refused(
      ada.client.comments.react({ commentId: ids.comment, reaction: 'tada', on: true }),
    );
    await refused(ada.client.comments.delete({ id: ids.comment }));
    await refused(
      ada.client.relations.add({ taskId: ids.task, kind: 'relates', otherTaskId: ids.other }),
    );
  });

  test("the project's own details", async () => {
    const project = await ada.client.projects.get({ id: ids.project });
    await refused(
      ada.client.projects.update({ id: ids.project, version: project.version, name: 'Renamed' }),
    );
  });

  test('attachments', async () => {
    const response = await ada.fetch(`/api/tasks/${ids.task}/attachments?name=a.txt`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'x',
    });
    expect(response.status).toBe(403);
  });

  test('reading still works, and restoring makes it writable again', async () => {
    expect(await ada.client.tasks.list({ projectId: ids.project })).toHaveLength(2);
    expect(await ada.client.comments.list({ taskId: ids.task })).toHaveLength(1);
    const project = await ada.client.projects.get({ id: ids.project });
    await ada.client.projects.restore({ id: ids.project, version: project.version });
    await ada.client.comments.create({ taskId: ids.task, body: 'Back' });
  });
});
