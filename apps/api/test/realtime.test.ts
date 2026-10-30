import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { relayOutbox } from '@teamflow/db';
import { PG_EVENTS_CHANNEL, type ServerMessage } from '@teamflow/realtime';
import type { Server } from 'bun';
import { createLogger } from '../src/logger.ts';
import {
  createGateway,
  type Gateway,
  type PresenceUpdate,
  type SocketData,
} from '../src/realtime/gateway.ts';
import { listen } from '../src/realtime/listen.ts';
import { createHarness, type Harness } from './harness.ts';

/** A test client that queues every message so tests can wait for the next one matching a predicate. */
async function connect(url: string, cookie: string) {
  const ws = new WebSocket(url, {
    headers: { cookie, origin: 'http://web.test' },
  } as unknown as string[]);
  const inbox: ServerMessage[] = [];
  const waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] =
    [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    const waiter = waiters.find((w) => w.match(message));
    if (waiter) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    } else inbox.push(message);
  });
  const closed = new Promise<number>((resolve) =>
    ws.addEventListener('close', (e) => resolve(e.code)),
  );
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  return {
    send: (message: unknown) => ws.send(JSON.stringify(message)),
    next<T extends ServerMessage['type']>(
      type: T,
      where: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    ) {
      const match = (m: ServerMessage) =>
        m.type === type && where(m as Extract<ServerMessage, { type: T }>);
      const queued = inbox.find(match);
      if (queued) {
        inbox.splice(inbox.indexOf(queued), 1);
        return Promise.resolve(queued as Extract<ServerMessage, { type: T }>);
      }
      return new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 2000);
        waiters.push({
          match,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m as Extract<ServerMessage, { type: T }>);
          },
        });
      });
    },
    /**
     * Every queued message of `type` so far. A ping/pong round trip is the barrier: the socket is ordered, so
     * anything published before the ping has arrived once the pong does.
     */
    async drain(type: ServerMessage['type']) {
      ws.send(JSON.stringify({ type: 'ping' }));
      await this.next('pong');
      return inbox.filter((m) => m.type === type);
    },
    close: () => ws.close(),
    closed,
  };
}

describe('realtime gateway', () => {
  let h: Harness;
  let gateway: Gateway;
  let server: Server<SocketData>;
  let url: string;
  const shared: PresenceUpdate[] = [];

  beforeAll(async () => {
    h = await createHarness();
    gateway = createGateway({
      db: h.db,
      auth: h.auth,
      logger: createLogger('silent'),
      notifyPresence: (update) => shared.push(update),
      nodeId: 'node-a',
    });
    server = Bun.serve<SocketData>({
      port: 0,
      fetch: (request, bunServer) => gateway.upgrade(request, bunServer),
      websocket: gateway.websocket,
    });
    gateway.bind(server);
    await listen(h.database.sql, gateway, createLogger('silent'));
    url = `ws://localhost:${server.port}/ws`;
  });

  afterAll(async () => {
    await server.stop(true);
    await h.destroy();
  });

  test('refuses an upgrade without a session', async () => {
    const response = await fetch(url.replace('ws:', 'http:'), {
      headers: { upgrade: 'websocket' },
    });
    expect(response.status).toBe(401);
  });

  test('delivers events for a subscribed project, and only for it', async () => {
    const ada = await h.owner('Ada');
    const board = await ada.client.projects.create({ key: 'RT', name: 'Realtime' });
    const other = await ada.client.projects.create({ key: 'OT', name: 'Other' });
    const socket = await connect(url, ada.cookie());
    await socket.next('ready');

    socket.send({ type: 'subscribe', channel: `project:${board.id}` });
    await socket.next('subscribed');

    const relay = (projectId: string, topic: string) =>
      gateway.publish({
        id: crypto.randomUUID(),
        organizationId: ada.organizationId,
        topic,
        payload: { projectId, taskId: crypto.randomUUID(), version: 2 },
        at: new Date().toISOString(),
      });

    relay(other.id, 'task.moved');
    relay(board.id, 'task.updated');
    const message = await socket.next('event');
    expect(message.channel).toBe(`project:${board.id}`);
    expect(message.event.topic).toBe('task.updated');
    expect(await socket.drain('event')).toEqual([]);
    socket.close();
  });

  test("never delivers another organization's events, even for the same project id", async () => {
    const ada = await h.owner('Ada2', 'ada2-org');
    const mallory = await h.owner('Mallory');
    const project = await ada.client.projects.create({ key: 'SEC', name: 'Secret' });

    const socket = await connect(url, mallory.cookie());
    await socket.next('ready');
    socket.send({ type: 'subscribe', channel: `project:${project.id}` });
    expect(await socket.next('error')).toMatchObject({
      code: 'NOT_FOUND',
      channel: `project:${project.id}`,
    });

    socket.send({ type: 'subscribe', channel: 'org' });
    await socket.next('subscribed');
    gateway.publish({
      id: crypto.randomUUID(),
      organizationId: ada.organizationId,
      topic: 'task.created',
      payload: { projectId: project.id },
      at: new Date().toISOString(),
    });
    expect(await socket.drain('event')).toEqual([]);
    socket.close();
  });

  test('rejects malformed messages and channels outside the protocol', async () => {
    const grace = await h.owner('Grace');
    const socket = await connect(url, grace.cookie());
    await socket.next('ready');
    socket.send({ type: 'subscribe', channel: `${crypto.randomUUID()}:org` });
    expect(await socket.next('error')).toMatchObject({ code: 'BAD_MESSAGE' });
    socket.send({ type: 'presence', channel: 'org', state: { taskId: null } });
    expect(await socket.next('error')).toMatchObject({ code: 'FORBIDDEN' });
    socket.close();
  });

  test('presence: viewers see each other, and leaving is broadcast', async () => {
    const ada = await h.owner('Ada3', 'ada3-org');
    const linus = await h.join(ada, 'Linus', 'member');
    const project = await ada.client.projects.create({ key: 'PRE', name: 'Presence' });
    const channel = `project:${project.id}` as const;

    const a = await connect(url, ada.cookie());
    await a.next('ready');
    a.send({ type: 'subscribe', channel });
    await a.next('subscribed');
    a.send({ type: 'presence', channel, state: { taskId: null } });
    await a.next('presence', (m) => m.members.length === 1);

    const b = await connect(url, linus.cookie());
    await b.next('ready');
    b.send({ type: 'subscribe', channel });
    await b.next('subscribed');
    const seen = await b.next('presence');
    expect(seen.members.map((m) => m.name)).toEqual(['Ada3']);

    b.send({ type: 'presence', channel, state: { taskId: null } });
    const both = await a.next('presence', (m) => m.members.length === 2);
    expect(both.members.map((m) => m.name).sort()).toEqual(['Ada3', 'Linus']);
    expect(shared.some((u) => u.member?.name === 'Linus' && u.node === 'node-a')).toBe(true);

    b.close();
    const after = await a.next('presence', (m) => m.members.length === 1);
    expect(after.members.map((m) => m.name)).toEqual(['Ada3']);
    a.close();
  });

  test('end to end: a mutation reaches subscribers through the outbox, the relay and LISTEN', async () => {
    const ada = await h.owner('Ada4', 'ada4-org');
    const project = await ada.client.projects.create({ key: 'E2E', name: 'End to end' });
    const socket = await connect(url, ada.cookie());
    await socket.next('ready');
    socket.send({ type: 'subscribe', channel: `project:${project.id}` });
    await socket.next('subscribed');

    const task = await ada.client.tasks.create({ projectId: project.id, title: 'Live' });
    // Nothing is delivered until the relay publishes: the write and the announcement are decoupled.
    expect(await socket.drain('event')).toEqual([]);

    while ((await relayOutbox(h.db, { channel: PG_EVENTS_CHANNEL })) > 0) {
      // drain every pending event, including ones from earlier tests
    }
    const event = await socket.next('event', (m) => m.event.topic === 'task.created');
    expect(event.event.payload).toMatchObject({
      taskId: task.id,
      projectId: project.id,
      version: 1,
    });
    socket.close();
  });

  test('a presence sent right behind its subscribe is accepted (messages are handled in order)', async () => {
    const ada = await h.owner('Ada5', 'ada5-org');
    const project = await ada.client.projects.create({ key: 'ORD', name: 'Ordering' });
    const channel = `project:${project.id}` as const;
    const socket = await connect(url, ada.cookie());
    await socket.next('ready');
    socket.send({ type: 'subscribe', channel });
    socket.send({ type: 'presence', channel, state: { taskId: null } });
    const seen = await socket.next('presence', (m) => m.members.length === 1);
    expect(seen.members[0]?.name).toBe('Ada5');
    expect(await socket.drain('error')).toEqual([]);
    socket.close();
  });

  test('personal events reach only their recipient, on the me channel', async () => {
    const ada = await h.owner('Ada6', 'ada6-org');
    const linus = await h.join(ada, 'Linus6', 'member');
    const project = await ada.client.projects.create({ key: 'ME', name: 'Personal' });
    const linusMember =
      (await ada.client.members.list()).find((m) => m.name === 'Linus6')?.id ?? '';

    const forLinus = await connect(url, linus.cookie());
    const forAda = await connect(url, ada.cookie());
    for (const socket of [forLinus, forAda]) {
      await socket.next('ready');
      socket.send({ type: 'subscribe', channel: 'me' });
      await socket.next('subscribed');
    }
    forAda.send({ type: 'presence', channel: 'me', state: { taskId: null } });
    expect(await forAda.next('error')).toMatchObject({ code: 'FORBIDDEN', channel: 'me' });

    await ada.client.tasks.create({
      projectId: project.id,
      title: 'For Linus',
      assigneeMemberId: linusMember,
    });
    while ((await relayOutbox(h.db, { channel: PG_EVENTS_CHANNEL })) > 0) {
      // drain
    }
    const event = await forLinus.next('event', (m) => m.event.topic === 'notifications.created');
    expect(event.channel).toBe('me');
    expect(event.event.payload).toMatchObject({
      kind: 'assigned',
      recipientMemberIds: [linusMember],
    });
    expect(
      (await forAda.drain('event')).filter((m) => m.type === 'event' && m.channel === 'me'),
    ).toEqual([]);
    forLinus.close();
    forAda.close();
  });

  test('presence from another node shows up, and expires if that node goes quiet', async () => {
    let clock = 1_000_000;
    const isolated = createGateway({
      db: h.db,
      auth: h.auth,
      logger: createLogger('silent'),
      nodeId: 'node-b',
      now: () => clock,
    });
    const published: string[] = [];
    isolated.bind({
      publish: (_topic: string, data: string) => published.push(data),
    } as unknown as Server<SocketData>);

    const topic = `${crypto.randomUUID()}:org`;
    isolated.receivePresence({
      node: 'node-c',
      topic,
      connectionId: 'c1',
      member: {
        connectionId: 'c1',
        memberId: crypto.randomUUID(),
        name: 'Remote',
        image: null,
        state: { taskId: null },
      },
    });
    expect(JSON.parse(published.at(-1) ?? '{}').members).toHaveLength(1);

    clock += 60_000;
    isolated.heartbeat();
    expect(JSON.parse(published.at(-1) ?? '{}').members).toHaveLength(0);
  });

  test('the org channel carries workspace-wide events; personal events go only to their recipients', async () => {
    const ada = await h.owner('Ivy', 'ivy-org');
    const linus = await h.join(ada, 'Ned', 'member');
    const members = await ada.client.members.list();
    const linusId = members.find((m) => m.name === 'Ned')?.id ?? '';
    const adaSocket = await connect(url, ada.cookie());
    const linusSocket = await connect(url, linus.cookie());
    for (const socket of [adaSocket, linusSocket]) {
      await socket.next('ready');
      socket.send({ type: 'subscribe', channel: 'org' });
      await socket.next('subscribed');
      socket.send({ type: 'subscribe', channel: 'me' });
      await socket.next('subscribed');
    }
    const publish = (topic: string, payload: Record<string, unknown>) =>
      gateway.publish({
        id: crypto.randomUUID(),
        organizationId: ada.organizationId,
        topic,
        payload,
        at: new Date().toISOString(),
      });

    publish('label.changed', { labelId: crypto.randomUUID(), projectId: null });
    publish('task.updated', { projectId: crypto.randomUUID(), taskId: crypto.randomUUID() });
    publish('project.created', { projectId: crypto.randomUUID() });
    publish('notifications.created', {
      recipientMemberIds: [linusId],
      taskId: crypto.randomUUID(),
    });

    const topics = async (socket: Awaited<ReturnType<typeof connect>>) =>
      (await socket.drain('event')).map((m) =>
        m.type === 'event' ? `${m.channel}:${m.event.topic}` : '',
      );
    expect(await topics(adaSocket)).toEqual(['org:label.changed', 'org:project.created']);
    expect(await topics(linusSocket)).toEqual([
      'org:label.changed',
      'org:project.created',
      'me:notifications.created',
    ]);
    adaSocket.close();
    linusSocket.close();
  });

  test('a removed member is disconnected with 4403 once sockets are re-checked', async () => {
    const ada = await h.owner('Kim', 'kim-org');
    const grace = await h.join(ada, 'Pat', 'member');
    const socket = await connect(url, grace.cookie());
    await socket.next('ready');
    socket.send({ type: 'subscribe', channel: 'org' });
    await socket.next('subscribed');

    const member = (await ada.client.members.list()).find((m) => m.name === 'Pat');
    await ada.authPost('/organization/remove-member', { memberIdOrEmail: member?.id });
    await gateway.revalidate({ organizationId: ada.organizationId });
    expect(await socket.closed).toBe(4403);
  });

  test('a member removed and invited back is reconnected, not left on the old membership', async () => {
    const ada = await h.owner('Rex', 'rex-org');
    const pat = await h.join(ada, 'Rae', 'member');
    const socket = await connect(url, pat.cookie());
    await socket.next('ready');

    const member = (await ada.client.members.list()).find((m) => m.name === 'Rae');
    await ada.authPost('/organization/remove-member', { memberIdOrEmail: member?.id });
    const invitation = await ada.authPost('/organization/invite-member', {
      email: pat.email,
      role: 'member',
      organizationId: ada.organizationId,
    });
    await pat.authPost('/organization/accept-invitation', { invitationId: invitation.id });
    await pat.authPost('/organization/set-active', { organizationId: ada.organizationId });

    // The old socket's personal channel is keyed by the old member id: it must reconnect as the new member.
    await gateway.revalidate({ organizationId: ada.organizationId });
    expect(await socket.closed).toBe(4403);
  });

  test('a socket that closes while subscribing leaves no presence behind', async () => {
    const ada = await h.owner('Zoe', 'zoe-org');
    const project = await ada.client.projects.create({ key: 'GH', name: 'Ghost' });
    const channel = `project:${project.id}` as const;
    const ghost = await connect(url, ada.cookie());
    await ghost.next('ready');
    // Subscribe and presence are queued; the socket closes before the subscribe's database check returns.
    ghost.send({ type: 'subscribe', channel });
    ghost.send({ type: 'presence', channel, state: { taskId: null } });
    ghost.close();
    await ghost.closed;

    const watcher = await connect(url, ada.cookie());
    await watcher.next('ready');
    watcher.send({ type: 'subscribe', channel });
    await watcher.next('subscribed');
    const present = await watcher.next('presence', (m) => m.channel === channel);
    expect(present.members).toEqual([]);
    watcher.close();
  });
});
