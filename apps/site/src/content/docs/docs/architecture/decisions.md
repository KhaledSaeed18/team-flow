---
title: Decisions
description: The architecture decision records behind TeamFlow.
sidebar:
  order: 4
---

Significant choices are written down as architecture decision records in
[`docs/adr`](https://github.com/KhaledSaeed18/team-flow/tree/main/docs/adr), with their context and
consequences, including the ones that were rejected.

| ADR                                                                                                            | Decision                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [0001](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0001-bun-and-turborepo.md)                | Bun runtime and workspaces, orchestrated by Turborepo                    |
| [0002](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0002-hono-and-orpc.md)                    | Hono for HTTP, oRPC contract-first procedures for the API                |
| [0003](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0003-drizzle-orm.md)                      | Drizzle ORM and SQL-first migrations                                     |
| [0004](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0004-application-layer-tenancy.md)        | Tenancy enforced by a scoped query layer and composite keys, not RLS     |
| [0005](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0005-better-auth.md)                      | Better Auth for identity, sessions and organizations                     |
| [0006](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0006-postgres-only-runtime.md)            | Postgres for queues, pub/sub and search — no Redis                       |
| [0007](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0007-outbox-and-activity-log.md)          | Transactional outbox and append-only activity log                        |
| [0008](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0008-fractional-ordering.md)              | Fractional indexing for board and backlog order                          |
| [0009](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0009-vite-spa-with-tanstack.md)           | A Vite SPA with TanStack Router and Query instead of an SSR framework    |
| [0010](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0010-tooling-biome.md)                    | Biome for lint and format                                                |
| [0011](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0011-react-aria-components.md)            | React Aria Components for the design system and accessible drag and drop |
| [0012](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0012-notifications-in-the-transaction.md) | Notifications are written in the transaction that causes them            |
| [0013](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0013-collaborative-descriptions.md)       | Collaborative descriptions with Yjs over the gateway                     |
| [0014](https://github.com/KhaledSaeed18/team-flow/blob/main/docs/adr/0014-auditing-auth-owned-changes.md)      | Auditing changes that Better Auth owns                                   |
