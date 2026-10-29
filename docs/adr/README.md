# Architecture Decision Records

Short records of decisions that shape the codebase. Each has a status (`Accepted`, `Superseded by NNNN`) and is never
rewritten after acceptance; a changed mind is a new record that supersedes the old one.

| #                                                | Decision                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| [0001](0001-bun-and-turborepo.md)                | Bun runtime and workspaces, orchestrated by Turborepo                    |
| [0002](0002-hono-and-orpc.md)                    | Hono for HTTP, oRPC contract-first procedures for the API                |
| [0003](0003-drizzle-orm.md)                      | Drizzle ORM and SQL-first migrations                                     |
| [0004](0004-application-layer-tenancy.md)        | Tenancy enforced by a scoped query layer and composite keys, not RLS     |
| [0005](0005-better-auth.md)                      | Better Auth for identity, sessions and organizations                     |
| [0006](0006-postgres-only-runtime.md)            | Postgres for queues, pub/sub and search — no Redis                       |
| [0007](0007-outbox-and-activity-log.md)          | Transactional outbox and append-only activity log                        |
| [0008](0008-fractional-ordering.md)              | Fractional indexing for board and backlog order                          |
| [0009](0009-vite-spa-with-tanstack.md)           | A Vite SPA with TanStack Router and Query instead of an SSR framework    |
| [0010](0010-tooling-biome.md)                    | Biome for lint and format                                                |
| [0011](0011-react-aria-components.md)            | React Aria Components for the design system and accessible drag and drop |
| [0012](0012-notifications-in-the-transaction.md) | Notifications are written in the transaction that causes them            |
| [0013](0013-collaborative-descriptions.md)       | Collaborative descriptions with Yjs over the gateway                     |
| [0014](0014-auditing-auth-owned-changes.md)      | Auditing changes that Better Auth owns                                   |

Template: copy `template.md`.
