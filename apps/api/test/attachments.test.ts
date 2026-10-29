import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MAX_ATTACHMENT_BYTES } from '@teamflow/contract';
import { createHarness, type Harness } from './harness.ts';

describe('attachments', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  let taskId: string;

  const upload = (
    who: { fetch: (input: string, init?: RequestInit) => Promise<Response> },
    task: string,
    name: string,
    body: string | Uint8Array,
    type = 'text/plain',
  ) =>
    who.fetch(`/api/tasks/${task}/attachments?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'content-type': type },
      body,
    });

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    const project = await ada.client.projects.create({ key: 'ATT', name: 'Attachments' });
    taskId = (await ada.client.tasks.create({ projectId: project.id, title: 'Spec' })).id;
  });
  afterAll(() => h.destroy());

  test('upload stores the object, lists it with a download link, and records history', async () => {
    const response = await upload(ada, taskId, '../../notes.txt', 'hello');
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string; fileName: string };
    expect(created.fileName).toBe('notes.txt');

    const [listed] = await ada.client.attachments.list({ taskId });
    expect(listed).toMatchObject({
      id: created.id,
      fileName: 'notes.txt',
      contentType: 'text/plain',
      sizeBytes: 5,
      uploaderName: 'Ada',
    });
    expect(listed?.url).toBeString();
    expect(h.storage.objects.size).toBe(1);
    const history = await ada.client.tasks.history({ id: taskId });
    expect(history.at(-1)?.kind).toBe('attachment.added');
  });

  test('delete removes the row and the object', async () => {
    const created = (await (await upload(ada, taskId, 'gone.txt', 'bye')).json()) as { id: string };
    const before = h.storage.objects.size;
    await ada.client.attachments.delete({ id: created.id });
    expect(h.storage.objects.size).toBe(before - 1);
    const names = (await ada.client.attachments.list({ taskId })).map((a) => a.fileName);
    expect(names).not.toContain('gone.txt');
  });

  test('refuses files over the limit and empty files', async () => {
    const big = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    expect((await upload(ada, taskId, 'big.bin', big)).status).toBe(413);
    expect((await upload(ada, taskId, 'empty.txt', '')).status).toBe(400);
  });

  test('guests can read but neither upload nor delete', async () => {
    const guest = await h.join(ada, 'Grace', 'guest');
    expect((await upload(guest, taskId, 'g.txt', 'g')).status).toBe(403);
    const seen = await guest.client.attachments.list({ taskId });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((a) => !a.canDelete)).toBe(true);
    expect((await ada.client.attachments.list({ taskId }))[0]?.canDelete).toBe(true);

    const [first] = await ada.client.attachments.list({ taskId });
    await expect(guest.client.attachments.delete({ id: first?.id ?? '' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  test('other workspaces see nothing', async () => {
    const eve = await h.owner('Eve');
    expect((await upload(eve, taskId, 'x.txt', 'x')).status).toBe(404);
    await expect(eve.client.attachments.list({ taskId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const [any] = await ada.client.attachments.list({ taskId });
    await expect(eve.client.attachments.delete({ id: any?.id ?? '' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
