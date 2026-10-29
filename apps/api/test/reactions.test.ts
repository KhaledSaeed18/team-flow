import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('comment reactions', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  let linus: Awaited<ReturnType<Harness['join']>>;
  let grace: Awaited<ReturnType<Harness['join']>>;
  let taskId: string;
  let commentId: string;

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    linus = await h.join(ada, 'Linus', 'member');
    grace = await h.join(ada, 'Grace', 'guest');
    const project = await ada.client.projects.create({ key: 'RX', name: 'Reactions' });
    taskId = (await ada.client.tasks.create({ projectId: project.id, title: 'Ship it' })).id;
    commentId = (await ada.client.comments.create({ taskId, body: 'Merged!' })).id;
  });
  afterAll(() => h.destroy());

  test('reactions group by kind, know who you are, and are idempotent', async () => {
    await linus.client.comments.react({ commentId, reaction: 'tada', on: true });
    await linus.client.comments.react({ commentId, reaction: 'tada', on: true });
    await grace.client.comments.react({ commentId, reaction: 'tada', on: true });
    const after = await ada.client.comments.react({ commentId, reaction: 'thumbsup', on: true });

    expect(after.reactions).toEqual([
      { reaction: 'tada', count: 2, mine: false, names: ['Linus', 'Grace'] },
      { reaction: 'thumbsup', count: 1, mine: true, names: ['Ada'] },
    ]);
    const [seenByLinus] = await linus.client.comments.list({ taskId });
    expect(seenByLinus?.reactions.find((r) => r.reaction === 'tada')?.mine).toBe(true);
  });

  test('removing takes back only your own', async () => {
    await linus.client.comments.react({ commentId, reaction: 'tada', on: false });
    await linus.client.comments.react({ commentId, reaction: 'tada', on: false });
    const [comment] = await ada.client.comments.list({ taskId });
    expect(comment?.reactions.find((r) => r.reaction === 'tada')).toMatchObject({
      count: 1,
      names: ['Grace'],
    });
  });

  test('unknown kinds, deleted comments and other workspaces are refused', async () => {
    await expect(
      ada.client.comments.react({ commentId, reaction: 'skull' as 'tada', on: true }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const eve = await h.owner('Eve');
    await expect(
      eve.client.comments.react({ commentId, reaction: 'heart', on: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const gone = await ada.client.comments.create({ taskId, body: 'Oops' });
    await ada.client.comments.delete({ id: gone.id });
    await expect(
      ada.client.comments.react({ commentId: gone.id, reaction: 'eyes', on: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
