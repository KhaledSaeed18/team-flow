import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Outputs } from '@teamflow/contract';
import { createHarness, type Harness } from './harness.ts';

type Signed = Awaited<ReturnType<Harness['owner']>>;

describe('comments and notifications', () => {
  let h: Harness;
  let ada: Signed;
  let linus: Signed;
  let grace: Signed;
  let project: Outputs['projects']['create'];
  const memberId = async (who: Signed) => {
    const list = await ada.client.members.list();
    const me = await who.client.me.get();
    return list.find((m) => m.userId === me.user.id)?.id ?? '';
  };

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    linus = await h.join(ada, 'Linus', 'member');
    grace = await h.join(ada, 'Grace', 'guest');
    project = await ada.client.projects.create({ key: 'COM', name: 'Comments' });
  });
  afterAll(() => h.destroy());

  test('assigning a task notifies the assignee, not the person assigning', async () => {
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Assigned work' });
    await ada.client.tasks.update({
      id: task.id,
      version: task.version,
      assigneeMemberId: await memberId(linus),
    });

    const inbox = await linus.client.notifications.list();
    expect(inbox.items[0]).toMatchObject({
      kind: 'assigned',
      taskId: task.id,
      actorName: 'Ada',
      data: { identifier: task.identifier, title: 'Assigned work' },
      readAt: null,
    });
    expect((await ada.client.notifications.list()).items.some((n) => n.taskId === task.id)).toBe(
      false,
    );
  });

  test('a mention notifies the mentioned; a comment notifies everyone else involved, never the author', async () => {
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Discuss',
      assigneeMemberId: await memberId(linus),
    });
    const graceId = await memberId(grace);
    const comment = await linus.client.comments.create({
      taskId: task.id,
      body: '@Grace can you check the CAN timing?',
      mentions: [graceId],
    });
    expect(comment).toMatchObject({ authorName: 'Linus', mentions: [graceId] });

    const forGrace = (await grace.client.notifications.list()).items.filter(
      (n) => n.taskId === task.id,
    );
    expect(forGrace.map((n) => n.kind)).toEqual(['mentioned']);
    expect(forGrace[0]?.data.excerpt).toBe('@Grace can you check the CAN timing?');

    // Ada created the task, so she hears about the comment; Linus wrote it, so he does not.
    const forAda = (await ada.client.notifications.list()).items.filter(
      (n) => n.taskId === task.id,
    );
    expect(forAda.map((n) => n.kind)).toEqual(['commented']);
    const forLinus = (await linus.client.notifications.list()).items.filter(
      (n) => n.taskId === task.id && n.kind !== 'assigned',
    );
    expect(forLinus).toEqual([]);
  });

  test('marking read only touches your own notifications', async () => {
    const before = await linus.client.notifications.list();
    expect(before.unread).toBeGreaterThan(0);
    const adaIds = (await ada.client.notifications.list()).items.map((n) => n.id);
    // Linus tries to mark Ada's as read: nothing of hers changes.
    await linus.client.notifications.markRead({ ids: adaIds });
    expect((await ada.client.notifications.list()).unread).toBe(adaIds.length);

    const after = await linus.client.notifications.markRead({ ids: null });
    expect(after.unread).toBe(0);
    expect((await linus.client.notifications.list({ unreadOnly: true })).items).toEqual([]);
  });

  test('only the author edits; moderators may delete', async () => {
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Moderation' });
    const comment = await linus.client.comments.create({ taskId: task.id, body: 'First draft' });
    const edited = await linus.client.comments.update({ id: comment.id, body: 'Second draft' });
    expect(edited.body).toBe('Second draft');
    expect(edited.editedAt).not.toBeNull();

    await expect(
      ada.client.comments.update({ id: comment.id, body: 'Rewritten' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(grace.client.comments.delete({ id: comment.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await ada.client.comments.delete({ id: comment.id });
    expect(await ada.client.comments.list({ taskId: task.id })).toEqual([]);
  });

  test('guests may comment', async () => {
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Open to guests' });
    await expect(
      grace.client.comments.create({ taskId: task.id, body: 'Looks good' }),
    ).resolves.toBeDefined();
  });

  test('another organization cannot read, comment, or be mentioned', async () => {
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Private' });
    const mallory = await h.owner('Mallory');
    await expect(mallory.client.comments.list({ taskId: task.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      mallory.client.comments.create({ taskId: task.id, body: 'hi' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const malloryMember = (await mallory.client.members.list())[0]?.id ?? '';
    await expect(
      ada.client.comments.create({ taskId: task.id, body: 'ping', mentions: [malloryMember] }),
    ).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    expect((await mallory.client.notifications.list()).items).toEqual([]);
  });
});
