# Roadmap

Milestones are built in order. Each one ends with its exit criteria met, tests green and docs updated.
Work lands as small pull requests into `dev`; `main` receives releases.

| Milestone                          | Status                           |
| ---------------------------------- | -------------------------------- |
| M0 Foundation                      | Done                             |
| M1 Data, identity and workspaces   | Done                             |
| M2 Projects, workflows and tasks   | Done                             |
| M3 Web app shell                   | Done (list view shipped with M8) |
| M4 Real-time                       | Done                             |
| M5 Planning and insight            | Done                             |
| M6 Collaboration and notifications | Done                             |
| M7 Collaborative documents         | Done                             |
| M8 Search and keyboard             | Done                             |
| M9 Public API                      | Done                             |
| M10 Ship                           | Done (deployment deferred)       |

## M0 — Foundation

- Archive v1 (tag `v1.0.0`), Bun workspaces + Turborepo, shared tsconfig, Biome, lefthook + commitlint.
- Docker Compose: PostgreSQL 18, RustFS (S3-compatible; MinIO images are no longer published), Mailpit.
- CI: install, lint, typecheck, test, build — with Turborepo caching.
- Agent and contributor docs: `AGENTS.md`, `CLAUDE.md`, project skills, PR template.

**Exit:** `bun install && bun run check` passes locally and in CI on an empty workspace.

## M1 — Data, identity and workspaces

- `packages/db`: Drizzle schema for users/sessions (Better Auth), organizations, memberships, invitations.
  Better Auth's team tables exist, but teams have no UI yet (see Deferred).
- `packages/auth`: email + password with OTP verification, optional GitHub OAuth (when credentials are set),
  organization plugin with custom roles.
- `apps/api`: Hono server, oRPC context with `Actor` and `Scope`, error mapping, OpenAPI at `/api/openapi.json`
  with a Scalar reference UI.
- Tenancy guard test and isolation suite.

**Exit:** sign up, verify, create an org, invite a second user, accept — all through the API, covered by
integration tests against a real database.

## M2 — Projects, workflows and tasks

- Projects with keys and per-project workflows (status categories: backlog, unstarted, started, done, canceled).
- Tasks: numbering per project, sub-tasks, relations, labels, estimates, priority, assignee, due date.
- Fractional ordering, optimistic concurrency with `version`, activity log, outbox.

**Exit:** a task's full history is reconstructable from `activity`; concurrent moves never collide.

## M3 — Web app shell

- Vite SPA, TanStack Router (file routes), oRPC TanStack Query utils, auth screens, org switcher, settings.
- Board (React Aria drag and drop, ADR-0011) and virtualized list views with optimistic updates.
- Design system in `packages/ui`, light/dark themes.

**Exit:** a user can run a project end to end in the browser.

## M4 — Real-time

- WebSocket gateway, channel auth, `LISTEN/NOTIFY` fan-out, outbox relay in `apps/worker`.
- Version-aware cache patching on the client, and presence: who is in a project and which task each person has
  open. (Live pointer cursors on the board were dropped; collaborative carets live in descriptions, M7.)

**Exit:** two browsers on the same board converge after concurrent edits; an api restart loses no events.

## M5 — Planning and insight

- Sprints (cycles) with carry-over, backlog grooming, scope-change tracking.
- Burndown, velocity, cycle time and cumulative flow charts.
- A calendar view of tasks by due date, with drag to reschedule.

## M6 — Collaboration and notifications

- Comments with @mentions and reactions, attachments (uploaded through the api, downloaded with signed S3 URLs).
- Notification inbox, real-time toasts, email digests via pg-boss + React Email.

## M7 — Collaborative documents

- Yjs task descriptions with a Tiptap editor, persistence and a search projection.

## M8 — Search and keyboard

- Postgres full-text search, command palette, shortcut layer, list filters and private or shared saved views.

## M9 — Public API

- Personal access tokens: hashed at rest, read-only or read-write, optional expiry, scoped to one workspace,
  accepted only on the REST API (`/api/v1`), and never able to manage tokens themselves.
- The OpenAPI document and Scalar reference describe bearer-token auth.

Out of scope for now, so the project stays fully local: the GitHub App (linking PRs by task key) and outgoing
webhooks.

## M10 — Ship

- Astro site + Starlight docs, Playwright E2E, seeded demo workspace, screenshots, README tour.
- An audit log of workspace changes (ADR-0014).

## Deferred

Kept out of scope while TeamFlow runs fully locally, and recorded here so the gap is deliberate:

- Container images and a hosted deployment.
- The GitHub App and outgoing webhooks (M9).
- Teams: the tables exist through Better Auth, but nothing in the product uses them yet.
