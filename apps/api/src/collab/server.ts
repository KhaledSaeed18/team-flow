import type { Auth } from '@teamflow/auth';
import { can, isRole } from '@teamflow/auth';
import {
  createScope,
  type Database,
  findMembership,
  findTask,
  loadTaskDocument,
  type Scope,
  StaleWriteError,
  saveTaskDocument,
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
import { plainText, seedFromText } from './document.ts';

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
  taskId: string;
  readOnly: boolean;
}

type Socket = ServerWebSocket<CollabData>;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  sockets: Map<Socket, Set<number>>;
  scope: Scope;
  taskId: string;
  lastEditor: string | null;
  saveTimer?: ReturnType<typeof setTimeout>;
  projectTimer?: ReturnType<typeof setTimeout>;
  ready: Promise<void>;
}

export interface CollabOptions {
  db: Database;
  auth: Auth;
  clock: Clock;
  logger: Logger;
  saveAfterMs?: number;
  projectAfterMs?: number;
}

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
    await saveTaskDocument(room.scope, room.taskId, Y.encodeStateAsUpdate(room.doc));
  }

  async function project(room: Room) {
    clearTimeout(room.projectTimer);
    if (!room.lastEditor) return;
    const scope = createScope(db, room.scope.organizationId, room.lastEditor);
    const text = plainText(room.doc);
    for (let attempt = 0; attempt < 3; attempt++) {
      const task = await findTask(scope, room.taskId);
      if (!task || task.description === text) return;
      try {
        await updateTask(scope, room.taskId, task.version, { description: text }, clock.now());
        return;
      } catch (error) {
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
    };

    created.ready = (async () => {
      const stored = await loadTaskDocument(scope, data.taskId);
      if (stored) Y.applyUpdate(doc, stored, 'load');
      else seedFromText(doc, (await findTask(scope, data.taskId))?.description ?? '');
    })();

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      const message = encode((e) => {
        encoding.writeVarUint(e, MESSAGE_SYNC);
        syncProtocol.writeUpdate(e, update);
      });
      for (const socket of created.sockets.keys()) socket.send(message);
      if (origin === 'load' || origin === 'seed') return;
      if (origin && typeof origin === 'object' && 'data' in origin) {
        created.lastEditor = (origin as Socket).data.memberId;
      }
      clearTimeout(created.saveTimer);
      created.saveTimer = setTimeout(() => void save(created).catch(failed('save')), saveAfterMs);
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
    if (current.sockets.size > 0) return;
    // Last one out: flush what is pending, then forget the document.
    rooms.delete(key);
    if (current.saveTimer) await save(current).catch(failed('save'));
    if (current.projectTimer) await project(current).catch(failed('projection'));
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
        taskId,
        readOnly: !can(role, { task: ['update'] }),
      };
      return server.upgrade(request, { data })
        ? undefined
        : new Response('Upgrade failed.', { status: 400 });
    },

    websocket: {
      async open(ws: Socket) {
        const current = room(ws.data);
        await current.ready;
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
        await current.ready;
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
