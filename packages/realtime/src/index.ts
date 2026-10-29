import { z } from 'zod';

/**
 * The realtime protocol (one WebSocket per tab, multiplexed by channel).
 *
 * Clients name channels without an organization (`org`, `project:<id>`); the server scopes every channel to the
 * organization of the session that opened the socket, so no message can name another tenant's channel.
 */

const Uuid = z.uuid();

/** `me` is the socket's own member: notifications and anything else addressed to one person. */
export const Channel = z.union([
  z.literal('org'),
  z.literal('me'),
  z.templateLiteral(['project:', Uuid]),
]);
export type Channel = z.infer<typeof Channel>;

export const projectChannel = (projectId: string): Channel => `project:${projectId}`;

export const PresenceState = z.object({
  /** The task the user has open, if any. */
  taskId: Uuid.nullable(),
});
export type PresenceState = z.infer<typeof PresenceState>;

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), channel: Channel }),
  z.object({ type: z.literal('unsubscribe'), channel: Channel }),
  z.object({ type: z.literal('presence'), channel: Channel, state: PresenceState }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

/** A domain event as published from the outbox. Payloads carry ids and versions, never row data. */
export const DomainEvent = z.object({
  id: Uuid,
  topic: z.string(),
  payload: z.record(z.string(), z.unknown()),
  at: z.string(),
});
export type DomainEvent = z.infer<typeof DomainEvent>;

export const PresenceMember = z.object({
  connectionId: z.string(),
  memberId: Uuid,
  name: z.string(),
  image: z.string().nullable(),
  state: PresenceState,
});
export type PresenceMember = z.infer<typeof PresenceMember>;

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), connectionId: z.string() }),
  z.object({ type: z.literal('subscribed'), channel: Channel }),
  z.object({ type: z.literal('event'), channel: Channel, event: DomainEvent }),
  z.object({ type: z.literal('presence'), channel: Channel, members: z.array(PresenceMember) }),
  z.object({
    type: z.literal('error'),
    code: z.enum(['BAD_MESSAGE', 'FORBIDDEN', 'NOT_FOUND']),
    channel: Channel.optional(),
  }),
  z.object({ type: z.literal('pong') }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

/** Postgres NOTIFY channel the outbox relay publishes to and every api node listens on. */
export const PG_EVENTS_CHANNEL = 'teamflow_events';
/** Postgres NOTIFY channel api nodes use to share presence with each other. */
export const PG_PRESENCE_CHANNEL = 'teamflow_presence';

/** What travels over `PG_EVENTS_CHANNEL`. */
export const RelayedEvent = DomainEvent.extend({ organizationId: Uuid });
export type RelayedEvent = z.infer<typeof RelayedEvent>;

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed = ClientMessage.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
