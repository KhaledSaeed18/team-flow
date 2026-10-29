---
title: Real-time
description: The event gateway, optimistic updates, presence, and collaborative documents.
sidebar:
  order: 3
---

## Events

Each browser tab holds one WebSocket to `/ws` and subscribes to channels: the organization, its own member
channel, and the projects it has open. Every subscription is authorized when it is made.

Events start as outbox rows written in the same transaction as the change. The worker's relay publishes them with
`pg_notify`, every api node hears them, and each forwards them to its subscribed sockets. If the api restarts
mid-flight, the events wait in the outbox: they can be late but never lost.

## Optimistic, then reconciled

The UI applies its own changes immediately, then replaces them with the server's answer. Writes carry a
`version`. A stale write is refused with `CONFLICT` and rolled back on screen, rather than overwriting someone
else's newer change.

Ordering uses fractional ranks: moving a card writes one row, with a key between its new neighbours, plus a little
randomness so two people dropping into the same gap still get distinct keys.

## Presence

Who has a task open is kept in memory on the api nodes and shared over `NOTIFY`. It is ephemeral and never
written to a table.

## Collaborative descriptions

Descriptions are [Yjs](https://yjs.dev) documents synced over `/collab/:taskId` with the y-websocket protocol
and edited in Tiptap. The server authorizes each connection, merges updates, persists the document state, and
derives a plain-text projection of the description for search and previews.
