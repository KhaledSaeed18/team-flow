<p align="center">
  <img src="assets/images/teamflow-banner.png" alt="TeamFlow" width="100%" />
</p>

# TeamFlow

A real-time, keyboard-first agile workspace. Boards update live for everyone on them, every card can be moved with
the keyboard as well as the mouse, and the whole stack runs on one Postgres database.

> The original NestJS + Prisma REST API is preserved at tag
> [`v1.0.0`](https://github.com/KhaledSaeed18/team-flow/tree/v1.0.0). v2 is a full rewrite.

<p align="center">
  <img src="apps/site/public/screenshots/board.png" alt="The Rover Firmware board for the active sprint, with a task open beside it" width="100%" />
</p>

## What it does

**Plan and track**

- Projects with keys (`RF-12`) and their own workflows. Tasks have priority, estimates, labels, assignees, due
  dates, sub-tasks and relations (blocks, relates, duplicates).
- Four views of the same work:
  - a board with accessible drag and drop (pointer, keyboard and screen reader);
  - a virtualized list with filters and private or shared saved views;
  - a calendar where you drag to reschedule;
  - sprint planning.
- Sprints with carry-over and a report: burndown, scope change, cumulative flow, velocity and cycle time, all
  replayed from an append-only activity log.

**Work together**

- Live updates and presence. Moves appear for everyone within a second, and you can see who is in a project and
  which task they have open.
- Descriptions are edited together, character by character (Yjs), with named carets.
- Comments with @mentions and reactions, file attachments, and an inbox with live toasts.
- Daily or weekly email summaries of what is unread.

**Find and control**

- Full-text search across tasks and comments, with typo tolerance. A ⌘K command palette and shortcuts for
  everything (`?` lists them).
- A typed public REST API (`/api/v1`) with an OpenAPI document. Personal access tokens can be read-only or
  read-write, with an optional expiry.
- Account settings for profile, password, sessions (sign out other devices) and tokens.
- An audit log for admins: people, invitations, projects, workflows, labels, sprints and tokens.

## A closer look

|                                                                                                        |                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| ![The list, sorted by priority with filters](apps/site/public/screenshots/list.png)                    | ![A month calendar of tasks by due date](apps/site/public/screenshots/calendar.png)       |
| **List.** Filter by person, priority, label or status, and save the result as a view.                  | **Calendar.** Drag a card to another day, or into the tray to unschedule it.              |
| ![Sprint report with burndown and cumulative flow](apps/site/public/screenshots/report.png)            | ![Planning with the active sprint and backlog](apps/site/public/screenshots/planning.png) |
| **Sprint report.** Burndown, cumulative flow, velocity and cycle time, replayed from the activity log. | **Planning.** Drag work between sprints and the backlog, with the keyboard too.           |
| ![The command palette searching tasks](apps/site/public/screenshots/palette.png)                       | ![The board in the dark theme](apps/site/public/screenshots/board-dark.png)               |
| **⌘K.** Search tasks, projects and actions, including what was said in comments.                       | **Dark theme**, chosen step by step rather than inverted.                                 |

## Stack

| Layer               | Choice                                                                             |
| ------------------- | ---------------------------------------------------------------------------------- |
| Runtime and tooling | Bun workspaces, Turborepo, Biome, lefthook, commitlint                             |
| API                 | Hono on Bun, oRPC (contract-first, typed client, OpenAPI), Better Auth             |
| Data                | PostgreSQL 18, Drizzle ORM, tenant scope with composite keys, transactional outbox |
| Realtime            | Bun WebSockets, Postgres `LISTEN/NOTIFY`, outbox relay worker, Yjs + Tiptap        |
| Jobs and email      | pg-boss in the same database, React Email, Mailpit locally                         |
| Files               | S3-compatible storage (RustFS locally), signed download URLs                       |
| Web                 | Vite, React 19, TanStack Router and Query, React Aria Components, Tailwind CSS v4  |
| Site and docs       | Astro, Starlight                                                                   |
| Testing             | bun test against real Postgres (template-cloned databases), Playwright             |

The reasoning behind each choice is in [`docs/adr`](docs/adr/README.md).

## Running it

Requirements: [Bun](https://bun.sh) 1.4+ and Docker.

```bash
bun install
cp .env.example .env
bun run infra:up     # postgres, s3-compatible storage, mailpit
bun run db:migrate
bun run db:seed      # a demo workspace with six weeks of history
bun run dev          # api :4000, web :5173, worker, docs site :4321
```

Open http://localhost:5173 and sign in as `demo@teamflow.dev` with the password `teamflow-demo`. Everyone else
in the demo (for example `maya@northwind.test`) uses the same password, so you can open a second browser and
watch changes arrive live. All email lands in Mailpit at http://localhost:8035.

```bash
bun run check                     # biome, typecheck and every test suite, which is what CI runs
bun run --cwd apps/web test:e2e   # Playwright journeys against a fresh, seeded stack
```

## Documentation

- **User and architecture docs:** the Starlight site in `apps/site`. Run `bun run dev` and open
  http://localhost:4321/docs/.
- **Working spec:** [`docs/`](docs/README.md) has the vision, architecture, roadmap, conventions and the
  [decision records](docs/adr/README.md).
- **Contributors:** `AGENTS.md` is the short version for contributors and coding agents.

## License

[MIT](LICENSE)
