import type { Auth } from '@teamflow/auth';
import { createScope, type Database, findMembership, findProject } from '@teamflow/db';
import {
  type Channel,
  type ClientMessage,
  type PresenceMember,
  type PresenceState,
  parseClientMessage,
  type RelayedEvent,
  type ServerMessage,
} from '@teamflow/realtime';
import type { Server, ServerWebSocket } from 'bun';
import type { Logger } from '../logger.ts';

/**
 * The realtime gateway (docs/ARCHITECTURE.md, "Real-time").
 *
 * One socket per tab. A socket belongs to exactly one organization — the session's active one when it connected —
 * and every channel it names is prefixed with that organization before it touches Bun's pub/sub, so a client
 * cannot even express another tenant's channel. Project channels are authorized on subscribe.
 *
 * Domain events arrive from Postgres (`LISTEN`, fed by the outbox relay) and are published to the matching topics.
 * Presence lives in memory; nodes share it with each other through `notifyPresence` and keep each other's entries
 * alive with a heartbeat.
 */

export interface SocketData {
  connectionId: string;
  organizationId: string;
  userId: string;
  memberId: string;
  name: string;
  image: string | null;
  channels: Set<Channel>;
  /** Messages from one socket are handled strictly in order (a subscribe must finish before its presence). */
  queue: Promise<void>;
}

export type Socket = ServerWebSocket<SocketData>;

/** A presence change shared between api nodes. `member: null` means the connection left the channel. */
export interface PresenceUpdate {
  node: string;
  topic: string;
  connectionId: string;
  member: PresenceMember | null;
}

export interface GatewayOptions {
  db: Database;
  auth: Auth;
  logger: Logger;
  /** Share a presence change with other api nodes (Postgres NOTIFY in production). */
  notifyPresence?: (update: PresenceUpdate) => void;
  nodeId?: string;
  now?: () => number;
}

const REMOTE_PRESENCE_TTL_MS = 45_000;

export function createGateway({
  db,
  auth,
  logger,
  notifyPresence = () => {},
  nodeId = crypto.randomUUID(),
  now = Date.now,
}: GatewayOptions) {
  let server: Server<SocketData> | null = null;
  const topicOf = (organizationId: string, channel: Channel) => `${organizationId}:${channel}`;

  /** topic → connectionId → entry. Local entries never expire; remote ones need a heartbeat. */
  const presence = new Map<
    string,
    Map<string, { member: PresenceMember; node: string; seenAt: number }>
  >();

  const send = (ws: Socket, message: ServerMessage) => ws.send(JSON.stringify(message));

  const broadcastPresence = (topic: string, channel: Channel) => {
    const entries = presence.get(topic);
    const members = entries ? [...entries.values()].map((e) => e.member) : [];
    server?.publish(
      topic,
      JSON.stringify({ type: 'presence', channel, members } satisfies ServerMessage),
    );
  };

  const setPresence = (ws: Socket, channel: Channel, state: PresenceState | null) => {
    const topic = topicOf(ws.data.organizationId, channel);
    const entries = presence.get(topic) ?? new Map();
    const member: PresenceMember | null = state
      ? {
          connectionId: ws.data.connectionId,
          memberId: ws.data.memberId,
          name: ws.data.name,
          image: ws.data.image,
          state,
        }
      : null;
    if (member) entries.set(ws.data.connectionId, { member, node: nodeId, seenAt: now() });
    else entries.delete(ws.data.connectionId);
    if (entries.size > 0) presence.set(topic, entries);
    else presence.delete(topic);
    broadcastPresence(topic, channel);
    notifyPresence({ node: nodeId, topic, connectionId: ws.data.connectionId, member });
  };

  async function authorize(
    ws: Socket,
    channel: Channel,
  ): Promise<'ok' | 'FORBIDDEN' | 'NOT_FOUND'> {
    const membership = await findMembership(db, ws.data.organizationId, ws.data.userId);
    if (!membership) return 'FORBIDDEN';
    if (channel === 'org') return 'ok';
    const projectId = channel.slice('project:'.length);
    const scope = createScope(db, ws.data.organizationId, membership.id);
    return (await findProject(scope, projectId)) ? 'ok' : 'NOT_FOUND';
  }

  async function handle(ws: Socket, message: ClientMessage) {
    switch (message.type) {
      case 'ping':
        send(ws, { type: 'pong' });
        return;
      case 'subscribe': {
        const verdict = await authorize(ws, message.channel);
        if (verdict !== 'ok') {
          send(ws, { type: 'error', code: verdict, channel: message.channel });
          if (verdict === 'FORBIDDEN') ws.close(4403, 'membership revoked');
          return;
        }
        ws.subscribe(topicOf(ws.data.organizationId, message.channel));
        ws.data.channels.add(message.channel);
        send(ws, { type: 'subscribed', channel: message.channel });
        // Show the newcomer who is already here.
        const entries = presence.get(topicOf(ws.data.organizationId, message.channel));
        send(ws, {
          type: 'presence',
          channel: message.channel,
          members: entries ? [...entries.values()].map((e) => e.member) : [],
        });
        return;
      }
      case 'unsubscribe':
        if (!ws.data.channels.delete(message.channel)) return;
        setPresence(ws, message.channel, null);
        ws.unsubscribe(topicOf(ws.data.organizationId, message.channel));
        return;
      case 'presence':
        // Presence is only accepted on channels the socket was authorized for.
        if (!ws.data.channels.has(message.channel)) {
          send(ws, { type: 'error', code: 'FORBIDDEN', channel: message.channel });
          return;
        }
        setPresence(ws, message.channel, message.state);
        return;
    }
  }

  return {
    bind(bunServer: Server<SocketData>) {
      server = bunServer;
    },

    /** Handle `GET /ws`: authenticate from the session cookie and upgrade, or answer with an error. */
    async upgrade(request: Request, bunServer: Server<SocketData>): Promise<Response | undefined> {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return new Response('Sign in to continue.', { status: 401 });
      const organizationId = session.session.activeOrganizationId;
      if (!organizationId) return new Response('Select an organization first.', { status: 412 });
      const membership = await findMembership(db, organizationId, session.user.id);
      if (!membership) return new Response('Not a member of this organization.', { status: 403 });

      const data: SocketData = {
        connectionId: crypto.randomUUID(),
        organizationId,
        userId: session.user.id,
        memberId: membership.id,
        name: session.user.name,
        image: session.user.image ?? null,
        channels: new Set(),
        queue: Promise.resolve(),
      };
      return bunServer.upgrade(request, { data })
        ? undefined
        : new Response('Upgrade failed.', { status: 400 });
    },

    websocket: {
      idleTimeout: 60,
      open(ws: Socket) {
        send(ws, { type: 'ready', connectionId: ws.data.connectionId });
      },
      message(ws: Socket, raw: string | Buffer) {
        const message = parseClientMessage(typeof raw === 'string' ? raw : raw.toString());
        if (!message) {
          send(ws, { type: 'error', code: 'BAD_MESSAGE' });
          return;
        }
        ws.data.queue = ws.data.queue
          .then(() => handle(ws, message))
          .catch((error: unknown) => {
            logger.error(
              { err: error, connectionId: ws.data.connectionId },
              'realtime message failed',
            );
          });
      },
      close(ws: Socket) {
        for (const channel of ws.data.channels) setPresence(ws, channel, null);
        ws.data.channels.clear();
      },
    },

    /** Fan a relayed domain event out to the organization channel and, if it has one, its project channel. */
    publish(event: RelayedEvent) {
      if (!server) return;
      const { organizationId, ...domainEvent } = event;
      const deliver = (channel: Channel) =>
        server?.publish(
          topicOf(organizationId, channel),
          JSON.stringify({ type: 'event', channel, event: domainEvent } satisfies ServerMessage),
        );
      deliver('org');
      const projectId = event.payload.projectId;
      if (typeof projectId === 'string') deliver(`project:${projectId}`);
    },

    /** Apply a presence change from another node. */
    receivePresence(update: PresenceUpdate) {
      if (update.node === nodeId) return;
      const entries = presence.get(update.topic) ?? new Map();
      if (update.member)
        entries.set(update.connectionId, {
          member: update.member,
          node: update.node,
          seenAt: now(),
        });
      else entries.delete(update.connectionId);
      if (entries.size > 0) presence.set(update.topic, entries);
      else presence.delete(update.topic);
      const channel = update.topic.slice(update.topic.indexOf(':') + 1) as Channel;
      broadcastPresence(update.topic, channel);
    },

    /**
     * Re-announce local presence (so other nodes keep it) and forget remote entries whose node went quiet.
     * Call on an interval.
     */
    heartbeat() {
      const cutoff = now() - REMOTE_PRESENCE_TTL_MS;
      for (const [topic, entries] of presence) {
        let changed = false;
        for (const [connectionId, entry] of entries) {
          if (entry.node === nodeId) {
            notifyPresence({ node: nodeId, topic, connectionId, member: entry.member });
          } else if (entry.seenAt < cutoff) {
            entries.delete(connectionId);
            changed = true;
          }
        }
        if (entries.size === 0) presence.delete(topic);
        if (changed) broadcastPresence(topic, topic.slice(topic.indexOf(':') + 1) as Channel);
      }
    },
  };
}

export type Gateway = ReturnType<typeof createGateway>;
