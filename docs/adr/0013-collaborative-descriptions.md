# 0013 — Collaborative descriptions with Yjs over the gateway

- Status: Accepted
- Date: 2026-10-29

## Context

Task descriptions are edited by several people at once. Last-write-wins on a text field loses work; locking is
hostile. The rest of the app already has a WebSocket server on Bun.

## Decision

- Descriptions are **Yjs documents** edited with Tiptap. The api serves the standard **y-websocket protocol** at
  `/collab/:taskId` on the same Bun server as the realtime gateway, so the browser uses the stock provider.
- Upgrades require a session and a membership in the task's organization; a task in another organization is
  `404`. Members without `task:update` (guests) receive the document but their updates are dropped server-side.
- One in-memory document per open task, loaded from `task_documents` (bytea) on first use — or seeded from the
  existing plain description — saved after edits settle, and released when the last editor leaves.
- A **plain-text projection** is written back to `tasks.description` through the normal versioned update, as the
  member who last edited, so search, previews and history keep working and the change is audited.
- A document lives on one node at a time. With several api nodes, `/collab/*` must be routed by task id (sticky
  routing); cross-node document relay is not attempted.

## Consequences

- Concurrent edits merge; offline edits merge on reconnect.
- Writing `description` through the REST API while a document exists is overwritten by the next projection; the
  document is the source of truth once it exists.
