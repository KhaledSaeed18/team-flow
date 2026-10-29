import type { Auth } from '@teamflow/auth';
import { can, isRole } from '@teamflow/auth';
import {
  createScope,
  type Database,
  findMembership,
  findTask,
  foreignKeyViolation,
  loadTaskDocument,
  type Scope,
  StaleWriteError,
  saveTaskDocument,
  seedTaskDocument,
  updateTask,
} from '@teamflow/db';
import type { Clock } from '@teamflow/domain';
import type { Server, ServerWebSocket } from 'bun';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import type { Logger } from '../logger.ts';
import { plainText, replaceText, seedFromText } from './document.ts';

/**
 * Collaborative task descriptions over the standard y-websocket protocol, so the browser uses the stock
 * `y-websocket` provider. One in-memory `Y.Doc` per open task, loaded from Postgres on first use, saved after
 * edits settle, and dropped when the last editor leaves. The plain-text projection is written back to the task
 * (and so to search and history) by the member who last edited.
 *
 * A document lives on one api node at a time; with several nodes, collaboration connections must be routed by
 * task id (see ADR-0013).
 */

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SAVE_AFTER_MS = 1_500;
const PROJECT_AFTER_MS = 4_000;

export interface CollabData {
  kind: 'collab';
  organizationId: string;
  memberId: string;
  userId: string;
  taskId: string;
  readOnly: boolean;
  /** The cookie the socket authenticated with, to re-check access while it stays open. */
  cookie: string;
}

type Socket = ServerWebSocket<CollabData>;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  sockets: Map<Socket, Set<number>>;
  scope: Scope;
  taskId: string;
  lastEditor: string | null;
  saveTimer?: ReturnType<typeof setTimeout> | undefined;
  projectTimer?: ReturnType<typeof setTimeout> | undefined;
  ready: Promise<void>;
  /** Sockets that asked to join and are waiting for the document to load. */
  pending: number;
}

export interface CollabOptions {
  db: Database;
  auth: Auth;
  clock: Clock;
  logger: Logger;
  saveAfterMs?: number;
  projectAfterMs?: number;
}

/** Origin of changes made outside the editor (the description replaced through the API). */
const EXTERNAL = 'external';

const COLLAB_PATH = /^\/collab\/([0-9a-f-]{36})$/;

export function createCollab({
  db,
  auth,
  clock,
  logger,
  saveAfterMs = SAVE_AFTER_MS,
  projectAfterMs = PROJECT_AFTER_MS,
}: CollabOptions) {
  const rooms = new Map<string, Room>();

  const encode = (write: (encoder: encoding.Encoder) => void) => {
    const encoder = encoding.createEncoder();
    write(encoder);
    return encoding.toUint8Array(encoder);
  };

  async function save(room: Room) {
    clearTimeout(room.saveTimer);
    room.saveTimer = undefined;
    await saveTaskDocument(room.scope, room.taskId, Y.encodeStateAsUpdate(room.doc));
  }

  async function project(room: Room) {
    clearTimeout(room.projectTimer);
    room.projectTimer = undefined;
    if (!room.lastEditor) return;
    let scope = createScope(db, room.scope.organizationId, room.lastEditor);
    const text = plainText(room.doc);
    for (let attempt = 0; attempt < 3; attempt++) {
      const task = await findTask(scope, room.taskId);
      if (!task || task.description === text) return;
      try {
        await updateTask(scope, room.taskId, task.version, { description: text }, clock.now());
        return;
      } catch (error) {
        // The last editor has left the workspace since: keep their words, without naming them.
        if (foreignKeyViolation(error) && scope.memberId) {
          scope = createScope(db, room.scope.organizationId, null);
          continue;
        }
        if (!(error instanceof StaleWriteError)) throw error;
      }
    }
  }

  const failed = (what: string) => (error: unknown) =>
    logger.error({ err: error }, `collab ${what} failed`);

  function room(data: CollabData): Room {
    const key = `${data.organizationId}:${data.taskId}`;
    const existing = rooms.get(key);
    if (existing) return existing;

    const doc = new Y.Doc({ gc: true });
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    const scope = createScope(db, data.organizationId, data.memberId);
    const created: Room = {
      doc,
      awareness,
      sockets: new Map(),
      scope,
      taskId: data.taskId,
      lastEditor: null,
      ready: Promise.resolve(),
      pending: 0,
    };

    created.ready = (async () => {
      const stored = await loadTaskDocument(scope, data.taskId);
      if (stored) {
        Y.applyUpdate(doc, stored, 'load');
        return;
      }
      // Seed once, durably. A seed that was not stored would be made again by the next room, under a new client
      // id, and a reconnecting editor's copy of the first seed would then show the text twice.
      const seed = new Y.Doc();
      seedFromText(seed, (await findTask(scope, data.taskId))?.description ?? '');
      const state = await seedTaskDocument(scope, data.taskId, Y.encodeStateAsUpdate(seed));
      seed.destroy();
      Y.applyUpdate(doc, state, 'load');
    })();
    // A room that failed to load is dropped, so the next connection tries again rather than waiting forever.
    created.ready.catch((error: unknown) => {
      failed('load')(error);
      if (rooms.get(key) === created) rooms.delete(key);
      for (const socket of created.sockets.keys())
        socket.close(1011, 'could not load the document');
      created.doc.destroy();
    });

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      const message = encode((e) => {
        encoding.writeVarUint(e, MESSAGE_SYNC);
        syncProtocol.writeUpdate(e, update);
      });
      for (const socket of created.sockets.keys()) socket.send(message);
      if (origin === 'load' || origin === 'seed') return;
      clearTimeout(created.saveTimer);
      created.saveTimer = setTimeout(() => void save(created).catch(failed('save')), saveAfterMs);
      // A change made through the API already wrote the task's description; only the document needs saving.
      if (origin === EXTERNAL) return;
      if (origin && typeof origin === 'object' && 'data' in origin) {
        created.lastEditor = (origin as Socket).data.memberId;
      }
      clearTimeout(created.projectTimer);
      created.projectTimer = setTimeout(
        () => void project(created).catch(failed('projection')),
        projectAfterMs,
      );
    });

    awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changed = [...added, ...updated, ...removed];
        const socket = origin as Socket | null;
        const owned = socket ? created.sockets.get(socket) : undefined;
        if (owned) {
          for (const id of added) owned.add(id);
          for (const id of removed) owned.delete(id);
        }
        const message = encode((e) => {
          encoding.writeVarUint(e, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            e,
            awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
          );
        });
        for (const peer of created.sockets.keys()) peer.send(message);
      },
    );

    rooms.set(key, created);
    return created;
  }

  async function close(ws: Socket) {
    const key = `${ws.data.organizationId}:${ws.data.taskId}`;
    const current = rooms.get(key);
    if (!current) return;
    const ids = current.sockets.get(ws);
    current.sockets.delete(ws);
    if (ids?.size) awarenessProtocol.removeAwarenessStates(current.awareness, [...ids], null);
    if (current.sockets.size > 0 || current.pending > 0) return;
    // Last one out: flush what is pending, then forget the document. The room stays findable while it saves, so
    // someone reconnecting meanwhile joins this document, with every edit, instead of loading an older copy.
    if (current.saveTimer) await save(current).catch(failed('save'));
    if (current.projectTimer) await project(current).catch(failed('projection'));
    if (current.sockets.size > 0 || current.pending > 0 || rooms.get(key) !== current) return;
    rooms.delete(key);
    current.doc.destroy();
  }

  return {
    matches: (pathname: string) => COLLAB_PATH.test(pathname),

    /** Handle `GET /collab/<taskId>`: a member of the task's organization may connect; guests read only. */
    async upgrade(request: Request, server: Server<CollabData>): Promise<Response | undefined> {
      const taskId = COLLAB_PATH.exec(new URL(request.url).pathname)?.[1];
      if (!taskId) return new Response('Not found.', { status: 404 });
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response('Sign in to continue.', { status: 401 });
      const organizationId = session.session.activeOrganizationId;
      if (!organizationId) return new Response('Select an organization first.', { status: 412 });
      const membership = await findMembership(db, organizationId, session.user.id);
      if (!membership) return new Response('Not a member of this organization.', { status: 403 });
      if (!(await findTask(createScope(db, organizationId, membership.id), taskId))) {
        return new Response('Not found.', { status: 404 });
      }
      const role = membership.role.split(',').find(isRole) ?? 'guest';
      const data: CollabData = {
        kind: 'collab',
        organizationId,
        memberId: membership.id,
        userId: session.user.id,
        taskId,
        readOnly: !can(role, { task: ['update'] }),
        cookie: request.headers.get('cookie') ?? '',
      };
      return server.upgrade(request, { data })
        ? undefined
        : new Response('Upgrade failed.', { status: 400 });
    },

    websocket: {
      async open(ws: Socket) {
        const current = room(ws.data);
        current.pending++;
        try {
          await current.ready;
        } catch {
          ws.close(1011, 'could not load the document');
          return;
        } finally {
          current.pending--;
        }
        current.sockets.set(ws, new Set());
        ws.send(
          encode((e) => {
            encoding.writeVarUint(e, MESSAGE_SYNC);
            syncProtocol.writeSyncStep1(e, current.doc);
          }),
        );
        const states = [...current.awareness.getStates().keys()];
        if (states.length > 0) {
          ws.send(
            encode((e) => {
              encoding.writeVarUint(e, MESSAGE_AWARENESS);
              encoding.writeVarUint8Array(
                e,
                awarenessProtocol.encodeAwarenessUpdate(current.awareness, states),
              );
            }),
          );
        }
      },

      async message(ws: Socket, raw: string | Buffer) {
        if (typeof raw === 'string') return;
        const current = rooms.get(`${ws.data.organizationId}:${ws.data.taskId}`);
        if (!current) return;
        try {
          await current.ready;
        } catch {
          return;
        }
        const decoder = decoding.createDecoder(new Uint8Array(raw));
        const type = decoding.readVarUint(decoder);
        if (type === MESSAGE_SYNC) {
          // A read-only connection may ask for the document (step 1) but never change it.
          const peek = decoding.createDecoder(new Uint8Array(raw));
          decoding.readVarUint(peek);
          const syncType = decoding.readVarUint(peek);
          if (ws.data.readOnly && syncType !== syncProtocol.messageYjsSyncStep1) return;

          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, current.doc, ws);
          if (encoding.length(encoder) > 1) ws.send(encoding.toUint8Array(encoder));
        } else if (type === MESSAGE_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(
            current.awareness,
            decoding.readVarUint8Array(decoder),
            ws,
          );
        }
      },

      close(ws: Socket) {
        void close(ws);
      },
    },

    /**
     * The description was replaced outside the editor (through the API). Put the new text into the live document,
     * so connected editors see it and nobody's next keystroke writes the old text back, or into the stored one.
     */
    async replaceDescription(organizationId: string, taskId: string, text: string) {
      const live = rooms.get(`${organizationId}:${taskId}`);
      if (live) {
        await live.ready;
        if (plainText(live.doc) !== text) replaceText(live.doc, text, EXTERNAL);
        return;
      }
      const scope = createScope(db, organizationId, null);
      const stored = await loadTaskDocument(scope, taskId);
      // No stored document yet: the next editor seeds from the new description anyway.
      if (!stored) return;
      const doc = new Y.Doc();
      Y.applyUpdate(doc, stored);
      if (plainText(doc) !== text) {
        replaceText(doc, text, EXTERNAL);
        await saveTaskDocument(scope, taskId, Y.encodeStateAsUpdate(doc));
      }
      doc.destroy();
    },

    /**
     * Re-check every connection's access: a removed member or revoked session is closed with 4403, and a member
     * demoted to guest becomes read-only. Run on an interval and after membership changes.
     */
    async revalidate() {
      for (const current of rooms.values()) {
        for (const ws of [...current.sockets.keys()]) {
          try {
            const session = await auth.api.getSession({
              headers: new Headers({ cookie: ws.data.cookie }),
            });
            const membership =
              session?.user.id === ws.data.userId
                ? await findMembership(db, ws.data.organizationId, ws.data.userId)
                : null;
            if (!membership || membership.id !== ws.data.memberId) {
              ws.close(4403, 'access revoked');
              continue;
            }
            const role = membership.role.split(',').find(isRole) ?? 'guest';
            ws.data.readOnly = !can(role, { task: ['update'] });
          } catch (error) {
            failed('revalidation')(error);
          }
        }
      }
    },

    /** Save everything still pending (shutdown). */
    async flush() {
      for (const current of rooms.values()) {
        await save(current).catch(failed('save'));
        await project(current).catch(failed('projection'));
      }
    },
  };
}

export type Collab = ReturnType<typeof createCollab>;
