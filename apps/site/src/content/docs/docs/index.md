---
title: What TeamFlow is
description: A real-time, keyboard-first agile workspace, and the engineering behind it.
---

TeamFlow is an agile workspace for small teams: projects with their own workflows, a board, a list and a
calendar, sprints with honest metrics, and collaboration that happens live.

It is also a portfolio project. The interesting work in a planning tool is not storing tasks. It is making them
feel local while many people change them at once. These docs cover both the product and how it is built.

## What it does

- **Projects and workflows.** Each project has a key (`RF-12`) and its own statuses, grouped into five types:
  backlog, to do, in progress, done and canceled.
- **Four views of the same work.** A board you can drive entirely from the keyboard, a virtualized list with
  filters and saved views, a calendar by due date, and sprint planning.
- **Sprints with real metrics.** Burndown, velocity, cycle time, scope change and cumulative flow. All of them
  are computed by replaying the activity log, not from snapshots.
- **Live collaboration.** Cards move in every open tab as you drag them, presence shows who is looking at a
  task, and descriptions are edited together, character by character.
- **Conversation and notice.** Comments with @mentions and reactions, an inbox with live toasts, and daily or
  weekly email summaries.
- **Find anything.** Full-text search across tasks and comments, a command palette, and shortcuts for
  everything.
- **A public API.** Every operation is in an OpenAPI document, callable with personal access tokens.
- **Accountability.** An audit log of who changed people, projects, workflows and tokens.

## How it is built

A Bun monorepo: Hono and oRPC on the server, Drizzle over PostgreSQL, a Vite + React SPA built on React Aria,
WebSockets with Yjs for collaboration, and pg-boss for jobs. PostgreSQL also handles queues, pub/sub, search and
the outbox, so the whole system runs on one database and an S3-compatible store.

Start with [Getting started](/docs/getting-started/) to run it, or [Architecture](/docs/architecture/overview/)
to see how the pieces fit.
