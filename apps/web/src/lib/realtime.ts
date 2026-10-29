import type {
  Channel,
  ClientMessage,
  DomainEvent,
  PresenceMember,
  PresenceState,
  ServerMessage,
} from '@teamflow/realtime';
import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * One WebSocket for the whole tab. Components subscribe to channels; the connection is opened on first use,
 * reconnects with backoff, and re-subscribes (and re-announces presence) after every reconnect.
 */

type EventListener = (event: DomainEvent) => void;
type Status = 'connecting' | 'open' | 'closed';

const RECONNECT_MAX_MS = 15_000;

class RealtimeConnection {
  private socket: WebSocket | null = null;
  private attempts = 0;
  /** Reconnecting once after a 4403, to tell a replaced session from lost access. */
  private recovering = false;
  private status: Status = 'closed';
  private readonly statusListeners = new Set<() => void>();
  private readonly channels = new Map<Channel, { refs: number; listeners: Set<EventListener> }>();
  private readonly presence = new Map<Channel, PresenceState>();
  private readonly members = new Map<Channel, PresenceMember[]>();
  private readonly memberListeners = new Map<Channel, Set<() => void>>();
  private readonly reconnectListeners = new Set<() => void>();
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  connectionId: string | null = null;

  getStatus = () => this.status;

  onStatus(listener: () => void) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Called after a reconnect, when events may have been missed. */
  onReconnect(listener: () => void) {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  subscribe(channel: Channel, listener: EventListener) {
    const entry = this.channels.get(channel) ?? { refs: 0, listeners: new Set() };
    entry.refs++;
    entry.listeners.add(listener);
    this.channels.set(channel, entry);
    this.ensureOpen();
    if (entry.refs === 1) this.send({ type: 'subscribe', channel });

    return () => {
      entry.listeners.delete(listener);
      entry.refs--;
      if (entry.refs === 0) {
        this.channels.delete(channel);
        this.presence.delete(channel);
        this.send({ type: 'unsubscribe', channel });
      }
    };
  }

  setPresence(channel: Channel, state: PresenceState) {
    this.presence.set(channel, state);
    this.send({ type: 'presence', channel, state });
  }

  getMembers = (channel: Channel) => this.members.get(channel) ?? EMPTY;

  onMembers(channel: Channel, listener: () => void) {
    const set = this.memberListeners.get(channel) ?? new Set();
    set.add(listener);
    this.memberListeners.set(channel, set);
    return () => {
      set.delete(listener);
    };
  }

  private setStatus(status: Status) {
    this.status = status;
    for (const listener of this.statusListeners) listener();
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private ensureOpen() {
    if (this.socket || typeof window === 'undefined') return;
    const url = new URL('/ws', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    this.setStatus('connecting');

    socket.addEventListener('message', (event) =>
      this.receive(JSON.parse(String(event.data)) as ServerMessage),
    );
    socket.addEventListener('close', (event) => {
      const wasReady = this.connectionId !== null;
      clearInterval(this.heartbeat);
      this.socket = null;
      this.connectionId = null;
      this.setStatus('closed');
      for (const [channel] of this.members) this.setMembers(channel, []);
      // 4403: the server no longer accepts this socket's session. That can mean access really ended, or only that
      // this device's session was replaced (changing the password does that). Reconnect once, with the current
      // cookie; if that is refused too, reload so the app shows where the person stands now.
      const refusedAgain = this.recovering && (event.code === 4403 || !wasReady);
      if (refusedAgain) {
        window.location.reload();
        return;
      }
      if (event.code === 4403) {
        this.recovering = true;
        // Counts as a reconnect, so listeners refetch whatever was missed meanwhile.
        this.attempts++;
        this.ensureOpen();
        return;
      }
      if (this.channels.size === 0) return;
      // Exponential backoff with jitter.
      const delay =
        Math.min(RECONNECT_MAX_MS, 500 * 2 ** this.attempts) * (0.5 + Math.random() / 2);
      this.attempts++;
      setTimeout(() => this.ensureOpen(), delay);
    });
  }

  private receive(message: ServerMessage) {
    switch (message.type) {
      case 'ready': {
        this.recovering = false;
        const reconnected = this.attempts > 0;
        this.attempts = 0;
        this.connectionId = message.connectionId;
        this.setStatus('open');
        for (const channel of this.channels.keys()) this.send({ type: 'subscribe', channel });
        for (const [channel, state] of this.presence)
          this.send({ type: 'presence', channel, state });
        this.heartbeat = setInterval(() => this.send({ type: 'ping' }), 25_000);
        if (reconnected) for (const listener of this.reconnectListeners) listener();
        return;
      }
      case 'event':
        for (const listener of this.channels.get(message.channel)?.listeners ?? [])
          listener(message.event);
        return;
      case 'presence':
        this.setMembers(message.channel, message.members);
        return;
      default:
        return;
    }
  }

  private setMembers(channel: Channel, members: PresenceMember[]) {
    this.members.set(channel, members);
    for (const listener of this.memberListeners.get(channel) ?? []) listener();
  }
}

const EMPTY: PresenceMember[] = [];

export const realtime = new RealtimeConnection();

/** Receive events on a channel for as long as the component is mounted. */
export function useChannel(channel: Channel | null, listener: EventListener) {
  const [latest] = useState(() => ({ current: listener }));
  latest.current = listener;
  useEffect(() => {
    if (!channel) return;
    return realtime.subscribe(channel, (event) => latest.current(event));
  }, [channel, latest]);
}

/** Announce this tab's presence on a channel and get everyone present (including other tabs of yours). */
export function usePresence(channel: Channel | null, state: PresenceState): PresenceMember[] {
  const taskId = state.taskId;
  useEffect(() => {
    if (channel) realtime.setPresence(channel, { taskId });
  }, [channel, taskId]);
  return useSyncExternalStore(
    (listener) => (channel ? realtime.onMembers(channel, listener) : () => {}),
    () => (channel ? realtime.getMembers(channel) : EMPTY),
  );
}

export function useRealtimeStatus(): Status {
  return useSyncExternalStore((listener) => realtime.onStatus(listener), realtime.getStatus);
}
