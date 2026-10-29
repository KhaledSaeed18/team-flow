import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Outputs } from '@teamflow/contract';
import { createHarness, type Harness } from './harness.ts';

type Project = Outputs['projects']['create'];
type Owner = Awaited<ReturnType<Harness['owner']>>;

const statusNamed = (project: Pick<Project, 'statuses'>, name: string) => {
  const status = project.statuses.find((s) => s.name === name);
  if (!status) throw new Error(`no status ${name}`);
  return status;
};

describe('members', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.destroy());

  test('lists the active organization only', async () => {
    const ada = await h.owner('Ada');
    await h.join(ada, 'Linus', 'member');
    await h.owner('Mallory');
    const list = await ada.client.members.list();
    expect(list.map((m) => [m.name, m.role])).toEqual([
      ['Ada', 'owner'],
      ['Linus', 'member'],
    ]);
  });
});

describe('labels', () => {
  let h: Harness;
  let ada: Owner;
  let project: Project;
  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    project = await ada.client.projects.create({ key: 'TF', name: 'TeamFlow' });
  });
  afterAll(() => h.destroy());

  test('organization labels show everywhere, project labels only in their project', async () => {
    const other = await ada.client.projects.create({ key: 'OT', name: 'Other' });
    await ada.client.labels.create({ name: 'Bug', color: '#ef4444' });
    await ada.client.labels.create({ projectId: project.id, name: 'Frontend', color: '#3b82f6' });

    const names = async (projectId?: string) =>
      (await ada.client.labels.list(projectId ? { projectId } : {})).map((l) => l.name);
    expect(await names(project.id)).toEqual(['Bug', 'Frontend']);
    expect(await names(other.id)).toEqual(['Bug']);
  });

  test('names are unique per scope, ignoring case', async () => {
    await ada.client.labels.create({ name: 'Docs', color: '#22c55e' });
    await expect(
      ada.client.labels.create({ name: 'docs', color: '#22c55e' }),
    ).rejects.toMatchObject({
      code: 'NAME_TAKEN',
    });
    await expect(
      ada.client.labels.create({ projectId: project.id, name: 'DOCS', color: '#22c55e' }),
    ).resolves.toBeDefined();
  });

  test('a project label cannot be put on a task of another project', async () => {
    const other = await ada.client.projects.create({ key: 'XP', name: 'Cross' });
    const label = await ada.client.labels.create({
      projectId: project.id,
      name: 'Scoped',
      color: '#000000',
    });
    await expect(
      ada.client.tasks.create({ projectId: other.id, title: 'x', labelIds: [label.id] }),
    ).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
  });

  test('deleting a label removes it from tasks', async () => {
    const label = await ada.client.labels.create({ name: 'Temporary', color: '#000000' });
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Tagged',
      labelIds: [label.id],
    });
    expect(task.labelIds).toEqual([label.id]);
    await ada.client.labels.delete({ id: label.id });
    expect((await ada.client.tasks.get({ id: task.id })).labelIds).toEqual([]);
  });

  test("other organizations' labels are invisible", async () => {
    const label = await ada.client.labels.create({ name: 'Secret', color: '#000000' });
    const mallory = await h.owner('Mallory');
    expect((await mallory.client.labels.list()).map((l) => l.id)).not.toContain(label.id);
    await expect(mallory.client.labels.update({ id: label.id, name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const theirs = await mallory.client.projects.create({ key: 'MAL', name: 'Mal' });
    await expect(
      mallory.client.tasks.create({ projectId: theirs.id, title: 'x', labelIds: [label.id] }),
    ).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
  });
});

describe('workflow', () => {
  let h: Harness;
  let ada: Owner;
  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
  });
  afterAll(() => h.destroy());

  test('adds a status in a chosen position', async () => {
    const project = await ada.client.projects.create({ key: 'WF', name: 'Workflow' });
    const todo = statusNamed(project, 'Todo');
    await ada.client.workflow.createStatus({
      projectId: project.id,
      name: 'Ready',
      category: 'unstarted',
      color: '#0ea5e9',
      afterId: todo.id,
    });
    const names = (await ada.client.projects.get({ id: project.id })).statuses.map((s) => s.name);
    expect(names).toEqual([
      'Backlog',
      'Todo',
      'Ready',
      'In Progress',
      'In Review',
      'Done',
      'Canceled',
    ]);
  });

  test('reorders, renames and rejects duplicate names', async () => {
    const project = await ada.client.projects.create({ key: 'RO', name: 'Reorder' });
    const done = statusNamed(project, 'Done');
    await ada.client.workflow.updateStatus({ id: done.id, name: 'Shipped', afterId: null });
    const names = (await ada.client.projects.get({ id: project.id })).statuses.map((s) => s.name);
    expect(names[0]).toBe('Shipped');
    await expect(
      ada.client.workflow.updateStatus({ id: done.id, name: 'todo' }),
    ).rejects.toMatchObject({
      code: 'NAME_TAKEN',
    });
  });

  test('deleting a status moves its tasks to one of the same type and records it', async () => {
    const project = await ada.client.projects.create({ key: 'DEL', name: 'Delete' });
    const review = statusNamed(project, 'In Review');
    const progress = statusNamed(project, 'In Progress');
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Reviewing',
      statusId: review.id,
    });

    await expect(
      ada.client.workflow.deleteStatus({
        id: review.id,
        moveTasksTo: statusNamed(project, 'Done').id,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_WORKFLOW' });

    await ada.client.workflow.deleteStatus({ id: review.id, moveTasksTo: progress.id });
    const moved = await ada.client.tasks.get({ id: task.id });
    expect(moved).toMatchObject({ statusId: progress.id, version: 2 });
    const history = await ada.client.tasks.history({ id: task.id });
    expect(history.at(-1)).toMatchObject({
      kind: 'task.moved',
      changes: [{ field: 'status', from: { id: review.id }, to: { id: progress.id } }],
    });
  });

  test('the last Todo-type or Done-type status cannot go', async () => {
    const project = await ada.client.projects.create({ key: 'LAST', name: 'Last' });
    const done = statusNamed(project, 'Done');
    const todo = statusNamed(project, 'Todo');
    await expect(
      ada.client.workflow.updateStatus({ id: done.id, category: 'started' }),
    ).rejects.toMatchObject({ code: 'INVALID_WORKFLOW' });
    // Todo is the only unstarted status; Backlog is a different category, so there is nowhere valid to move to.
    await expect(
      ada.client.workflow.deleteStatus({
        id: todo.id,
        moveTasksTo: statusNamed(project, 'Backlog').id,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_WORKFLOW' });
  });

  test('changing a status type is refused while tasks use it', async () => {
    const project = await ada.client.projects.create({ key: 'TYPE', name: 'Type' });
    const review = statusNamed(project, 'In Review');
    await ada.client.tasks.create({ projectId: project.id, title: 'Busy', statusId: review.id });
    await expect(
      ada.client.workflow.updateStatus({ id: review.id, category: 'completed' }),
    ).rejects.toMatchObject({ code: 'INVALID_WORKFLOW' });
  });

  test('members cannot edit the workflow', async () => {
    const project = await ada.client.projects.create({ key: 'PERM', name: 'Perm' });
    const linus = await h.join(ada, 'Linus', 'member');
    await expect(
      linus.client.workflow.createStatus({
        projectId: project.id,
        name: 'Mine',
        category: 'started',
        color: '#000000',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
