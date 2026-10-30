---
title: Overview
description: The monorepo, the runtime, and how a request becomes a change everyone sees.
sidebar:
  order: 1
---

## The pieces

```
apps/
  api/        Hono on Bun: oRPC procedures, REST + OpenAPI, auth, WebSockets
  worker/     pg-boss: outbox relay, email delivery, hourly digests, rank rebalancing
  web/        Vite + React SPA: TanStack Router and Query, React Aria, Tailwind
  site/       this site: Astro and Starlight
packages/
  contract/   oRPC contract and Zod schemas, the single source of wire shapes
  db/         Drizzle schema, migrations, repositories and the tenant Scope
  domain/     pure logic: ranks, workflows, filters, metrics, calendar dates
  auth/       Better Auth configuration and the role permission table
  realtime/   the WebSocket message protocol
  email/      React Email templates
  ui/         design tokens and React Aria components
```

Dependencies point one way: apps depend on packages, and `domain` depends on nothing but Zod. The web app never
touches the database; everything goes through the contract.

## At runtime

```
browser ── HTTP (oRPC) ───────────▶ api ──▶ PostgreSQL ◀── worker ──▶ SMTP
        ── WebSocket: events ─────▶  │        │  ▲
        ── WebSocket: Yjs docs ───▶  │        │  └─ LISTEN/NOTIFY wakes the relay
                                     └──▶ S3-compatible storage
```

There are two stateful services: PostgreSQL and object storage. Queues (pg-boss), pub/sub (`LISTEN/NOTIFY`),
full-text search and the outbox all live in PostgreSQL, so there is no Redis.

## One request, end to end

1. **Middleware.** The session cookie, or a bearer token on the public API, becomes a member of one organization
   with a role. Every tenant table is reached through a `Scope` bound to that organization.
2. **Contract.** The input is validated by the procedure's Zod schema. The same schema typed the client call and
   produced the OpenAPI document.
3. **Service.** The service loads what it needs, checks permissions against the loaded resource, and calls a
   repository.
4. **One transaction.** The change, its activity rows (history and metrics), any notifications, and outbox events
   commit together. Anything that changed is described, and anything described really happened.
5. **Fan-out.** The outbox insert wakes the worker's relay, which publishes each event once. Every api node
   pushes it to subscribed sockets, and browsers patch their caches in place.

Read on: [Tenancy](/docs/architecture/tenancy/), [Real-time](/docs/architecture/real-time/), and
[Decisions](/docs/architecture/decisions/).
