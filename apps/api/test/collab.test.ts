import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createScope, findMembership, loadTaskDocument } from '@teamflow/db';
import type { Server } from 'bun';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { FRAGMENT, plainText } from '../src/collab/document.ts';
import { type CollabData, createCollab } from '../src/collab/server.ts';
import { createLogger } from '../src/logger.ts';
import { createHarness, type Harness } from './harness.ts';

/** Resolve once `check` holds, re-checking on every document change (no fixed sleeps). */
const until = (doc: Y.Doc, check: () => boolean) =>
  new Promise<void>((resolve, reject) => {
    if (check()) return resolve();
    const timer = setTimeout(() => reject(new Error('timed out')), 3000);
    const onUpdate = () => {
      if (!check()) return;
      clearTimeout(timer);
      doc.off('update', onUpdate);
      resolve();
    };
    doc.on('update', onUpdate);
  });

/** Poll a condition that has no event to wait on (a database write after the last editor leaves). */
async function eventually<T>(read: () => Promise<T>, ok: (value: T) => boolean): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const value = await read();
    if (ok(value)) return value;
    await new Promise((resolve) => queueMicrotask(() => setTimeout(resolve, 20)));
  }
  throw new Error('condition never held');
}

const write = (doc: Y.Doc, text: string) => {
  const paragraph = new Y.XmlElement('paragraph');
  paragraph.insert(0, [new Y.XmlText(text)]);
  doc.getXmlFragment(FRAGMENT).push([paragraph]);
};

describe('collaborative descriptions', () => {
  let h: Harness;
  let server: Server<CollabData>;
  let base: string;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  let project: { id: string };
  let collab: ReturnType<typeof createCollab>;

  const open = (cookie: string, taskId: string) => {
    const doc = new Y.Doc();
    class WithCookie extends WebSocket {
      constructor(url: string | URL) {
        super(url, { headers: { cookie } } as unknown as string[]);
      }
    }
    const provider = new WebsocketProvider(base, taskId, doc, {
      WebSocketPolyfill: WithCookie as unknown as typeof WebSocket,
      disableBc: true,
    });
    const synced = new Promise<void>((resolve) => provider.once('sync', () => resolve()));
    return { doc, provider, synced, close: () => provider.destroy() };
  };

  beforeAll(async () => {
    h = await createHarness();
    collab = createCollab({
      db: h.db,
      auth: h.auth,
      clock: h.clock,
      logger: createLogger('silent'),
      saveAfterMs: 10,
      projectAfterMs: 10,
    });
    server = Bun.serve<CollabData>({
      port: 0,
      fetch: (request, bunServer) => collab.upgrade(request, bunServer),
      websocket: collab.websocket,
    });
    base = `ws://localhost:${server.port}/collab`;
    ada = await h.owner('Ada');
    project = await ada.client.projects.create({ key: 'DOC', name: 'Docs' });
  });

  afterAll(async () => {
    await server.stop(true);
    await h.destroy();
  });

  test('two editors converge, and the text is saved and projected onto the task', async () => {
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Spec' });
    const linus = await h.join(ada, 'Linus', 'member');
    const a = open(ada.cookie(), task.id);
    const b = open(linus.cookie(), task.id);
    await Promise.all([a.synced, b.synced]);

    write(a.doc, 'Wheel odometry drifts after long runs.');
    await until(b.doc, () => plainText(b.doc).includes('odometry'));
    write(b.doc, 'Compare against the IMU heading.');
    await until(a.doc, () => plainText(a.doc).includes('IMU'));
    expect(plainText(a.doc)).toBe(plainText(b.doc));

    a.close();
    b.close();
    const saved = await eventually(
      () => ada.client.tasks.get({ id: task.id }),
      (t) => t.description.includes('IMU'),
    );
    expect(saved.description).toBe(
      'Wheel odometry drifts after long runs.\nCompare against the IMU heading.',
    );

    const history = await ada.client.tasks.history({ id: task.id });
    expect(history.at(-1)?.changes[0]?.field).toBe('description');

    // A new session starts from the stored document.
    const again = open(ada.cookie(), task.id);
    await again.synced;
    expect(plainText(again.doc)).toContain('IMU heading');
    again.close();
  });

  test('an existing plain description seeds the document', async () => {
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Seeded',
      description: 'First line\nSecond line',
    });
    const a = open(ada.cookie(), task.id);
    await a.synced;
    expect(plainText(a.doc)).toBe('First line\nSecond line');
    a.close();
  });

  test('guests can read but their edits are not applied', async () => {
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Read only',
      description: 'Hello',
    });
    const guest = await h.join(ada, 'Guest', 'guest');
    const g = open(guest.cookie(), task.id);
    const a = open(ada.cookie(), task.id);
    await Promise.all([g.synced, a.synced]);
    expect(plainText(g.doc)).toBe('Hello');

    write(g.doc, 'Vandalism');
    write(a.doc, 'Real edit');
    await until(g.doc, () => plainText(g.doc).includes('Real edit'));
    expect(plainText(a.doc)).not.toContain('Vandalism');
    g.close();
    a.close();

    const scope = createScope(
      h.db,
      ada.organizationId,
      (await findMembership(h.db, ada.organizationId, (await ada.client.me.get()).user.id))?.id ??
        null,
    );
    const stored = await eventually(
      () => loadTaskDocument(scope, task.id),
      (s) => s !== null,
    );
    const check = new Y.Doc();
    Y.applyUpdate(check, stored ?? new Uint8Array());
    expect(plainText(check)).not.toContain('Vandalism');
  });

  test('another organization cannot open the document', async () => {
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Private' });
    const mallory = await h.owner('Mallory');
    const response = await fetch(`${base.replace('ws:', 'http:')}/${task.id}`, {
      headers: { cookie: mallory.cookie(), upgrade: 'websocket' },
    });
    expect(response.status).toBe(404);
    const anonymous = await fetch(`${base.replace('ws:', 'http:')}/${task.id}`, {
      headers: { upgrade: 'websocket' },
    });
    expect(anonymous.status).toBe(401);
  });

  test('a reconnecting editor does not see a seeded description twice', async () => {
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'Reconnect',
      description: 'Only once',
    });
    const first = open(ada.cookie(), task.id);
    await first.synced;
    // The seed is stored straight away, before anyone edits.
    const scope = createScope(h.db, ada.organizationId, null);
    expect(await loadTaskDocument(scope, task.id)).not.toBeNull();
    // Everyone leaves, so the room is dropped; the same local document then reconnects to a new room.
    const left = new Promise<void>((resolve) =>
      first.provider.once('connection-close', () => resolve()),
    );
    first.provider.disconnect();
    await left;
    const resynced = new Promise<void>((resolve) =>
      first.provider.once('sync', (synced: boolean) => synced && resolve()),
    );
    first.provider.connect();
    await resynced;
    expect(plainText(first.doc)).toBe('Only once');
    first.close();
  });

  test('a description replaced through the API reaches open editors and the stored document', async () => {
    const task = await ada.client.tasks.create({
      projectId: project.id,
      title: 'External',
      description: 'Old words',
    });
    const editor = open(ada.cookie(), task.id);
    await editor.synced;
    await collab.replaceDescription(ada.organizationId, task.id, 'New words\nfrom a script');
    await until(editor.doc, () => plainText(editor.doc).includes('New words'));
    expect(plainText(editor.doc)).toBe('New words\nfrom a script');
    editor.close();

    // With nobody connected, the stored document is rewritten instead.
    await eventually(
      async () => {
        await collab.replaceDescription(ada.organizationId, task.id, 'Third version');
        const later = open(ada.cookie(), task.id);
        await later.synced;
        const text = plainText(later.doc);
        later.close();
        return text;
      },
      (text) => text === 'Third version',
    );
  });

  test('a member removed from the workspace is disconnected', async () => {
    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Revoked' });
    const pat = await h.join(ada, 'Pat', 'member');
    const socket = open(pat.cookie(), task.id);
    await socket.synced;
    const closed = new Promise<number>((resolve) =>
      socket.provider.once('connection-close', (event: CloseEvent | null) =>
        resolve(event?.code ?? 0),
      ),
    );
    const member = (await ada.client.members.list()).find((m) => m.name === 'Pat');
    await ada.authPost('/organization/remove-member', { memberIdOrEmail: member?.id });
    await collab.revalidate();
    expect(await closed).toBe(4403);
    socket.close();
  });
});
