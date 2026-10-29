# Roadmap

Milestones are built in order. Each one ends with its exit criteria met, tests green and docs updated.
Work lands as small pull requests into `dev`; `main` receives releases.

| Milestone                          | Status                                            |
| ---------------------------------- | ------------------------------------------------- |
| M0 Foundation                      | Done                                              |
| M1 Data, identity and workspaces   | Done                                              |
| M2 Projects, workflows and tasks   | Done                                              |
| M3 Web app shell                   | Done (list view moves to M8 with saved views)     |
| M4 Real-time                       | Done                                              |
| M5 Planning and insight            | Done                                              |
| M6 Collaboration and notifications | Done except email digests                         |
| M7 Collaborative documents         | Done                                              |
| M8 Search and keyboard             | Done                                              |
| M9 Integrations and API            | Planned                                           |
| M10 Ship                           | E2E and seed done; site next; deployment deferred |

## M0 — Foundation

- Archive v1 (tag `v1.0.0`), Bun workspaces + Turborepo, shared tsconfig, Biome, lefthook + commitlint.
- Docker Compose: PostgreSQL 17, MinIO, Mailpit.
- CI: install, lint, typecheck, test, build — with Turborepo caching.
- Agent and contributor docs: `AGENTS.md`, `CLAUDE.md`, project skills, PR template.

**Exit:** `bun install && bun run check` passes locally and in CI on an empty workspace.

## M1 — Data, identity and workspaces

- `packages/db`: Drizzle schema for users/sessions (Better Auth), organizations, memberships, invitations, teams.
- `packages/auth`: email + password with OTP verification, GitHub OAuth, organization plugin with custom roles.
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
- Board (dnd-kit) and virtualized list views with optimistic updates.
- Design system in `packages/ui`, light/dark themes.

**Exit:** a user can run a project end to end in the browser.

## M4 — Real-time

- WebSocket gateway, channel auth, `LISTEN/NOTIFY` fan-out, outbox relay in `apps/worker`.
- Cache patching on the client, presence avatars and live board cursors.

**Exit:** two browsers on the same board converge after concurrent edits; an api restart loses no events.

## M5 — Planning and insight

- Sprints (cycles) with carry-over, backlog grooming, scope-change tracking.
- Burndown, velocity, cycle time and cumulative flow charts.

## M6 — Collaboration and notifications

- Comments with @mentions and reactions, attachments (uploaded through the api, downloaded with signed S3 URLs).
- Notification inbox, real-time toasts, email digests via pg-boss + React Email.

## M7 — Collaborative documents

- Yjs task descriptions with a Tiptap editor, persistence and a search projection.

## M8 — Search and keyboard

- Postgres full-text search, command palette, shortcut layer, list filters and private or shared saved views.

## M9 — Integrations and API

- GitHub App: link PRs/commits by task key, auto-transition on merge.
- Personal access tokens, outgoing webhooks with signed payloads and retries.

## M10 — Ship

- Astro site + Starlight docs, Playwright E2E, seeded demo workspace, screenshots.
- Container images, deployment, README tour.
