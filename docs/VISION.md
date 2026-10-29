# TeamFlow v2 — Vision

TeamFlow started as a NestJS + Prisma REST backend for multi-tenant agile workspaces (v1, tagged `v1.0.0`).
v2 turns it into a full-stack product: a **real-time, keyboard-first agile workspace** that feels local even though
the data lives on a server.

## What v2 is about

The interesting engineering in a planning tool is not CRUD. It is:

1. **Many people editing the same board at once.** Drag a card and every open tab sees it move within a frame or two.
   Presence shows who is looking at what. Task descriptions are edited collaboratively, character by character.
2. **The UI never waits for the network.** Mutations are optimistic, ordering is conflict-free (fractional indexes),
   and the cache is patched from server events instead of being refetched.
3. **Type safety from the database row to the React prop.** One contract defines every procedure; the client, the
   server and the published OpenAPI document are all derived from it.
4. **Postgres does the heavy lifting.** Queues, pub/sub, full-text search and the outbox all live in the one database
   we already run, so the stack stays small enough to self-host on a single box.
5. **Insight, not just storage.** Burndown, velocity, cycle time and cumulative flow are computed from an append-only
   activity log rather than from snapshots someone forgot to take.

## Product scope

| Area          | v2 capability                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Workspaces    | Organizations, invitations, roles (owner / admin / member / guest), teams                                 |
| Projects      | Project keys (`TF-42`), custom workflows per project, archive/restore                                     |
| Work items    | Tasks with sub-tasks, relations (blocks / relates / duplicates), estimates, priority, labels, due dates   |
| Views         | Board, list (virtualized table), backlog, calendar, saved filters                                         |
| Planning      | Cycles/sprints with carry-over, scope change tracking, burndown and velocity                              |
| Collaboration | Live board updates, presence, collaborative rich-text descriptions, comments with @mentions and reactions |
| Notifications | In-app inbox, real-time toasts, batched email digests                                                     |
| Search        | Full-text search across tasks and comments, command palette (`⌘K`), keyboard shortcuts everywhere         |
| Integrations  | Deferred: GitHub linking and outgoing webhooks are out of scope while TeamFlow runs fully locally         |
| Platform      | Public, documented API (OpenAPI), personal access tokens, audit log                                       |

## Explicitly out of scope

- Mobile apps, time tracking and invoicing, Gantt charts with dependencies scheduling.
- A plugin marketplace.
- Per-tenant databases or Postgres row-level security (see ADR-0004 for why tenancy is enforced in the
  application layer here).

## Relationship to the author's other project

TeamFlow and [PatchGrid](https://github.com/KhaledSaeed18/patchgrid) are deliberately built on different stacks and
explore different problems. PatchGrid is about isolation, authorization depth and cloud operations (NestJS, Next.js,
Prisma + RLS, BullMQ, AWS). TeamFlow is about real-time collaboration, end-to-end type safety and a lean
Postgres-only runtime (Bun, Hono + oRPC, Drizzle, pg-boss, WebSockets + Yjs, a Vite SPA).
