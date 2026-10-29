<p align="center">
  <img src="assets/images/teamflow-banner.png" alt="TeamFlow" width="100%" />
</p>

# TeamFlow

A real-time, keyboard-first agile workspace. Boards update live for everyone on them, every card can be moved with
the keyboard as well as the mouse, and the whole stack runs on one Postgres database.

> **v2 is under active development** on the `dev` branch. The original NestJS + Prisma REST API is preserved at tag
> [`v1.0.0`](https://github.com/KhaledSaeed18/team-flow/tree/v1.0.0).

## What works today

- Sign up with an emailed code, workspaces, invitations and roles (owner, admin, member, guest)
- Projects with their own workflows; tasks with priority, estimates, labels, assignees, sub-tasks and due dates
- A board with accessible drag and drop — pointer, keyboard and screen reader — and optimistic moves
- A task panel with inline editing and a history built from a field-level activity log
- Live updates and presence: see who is on the board and which task they have open; moves appear for everyone
  within a second
- A typed public API (`/api/v1`) with an OpenAPI document and reference at `/api/docs`

## Stack

| Layer               | Choice                                                                             |
| ------------------- | ---------------------------------------------------------------------------------- |
| Runtime and tooling | Bun workspaces, Turborepo, Biome, lefthook, commitlint                             |
| API                 | Hono on Bun, oRPC (contract-first, typed client, OpenAPI), Better Auth             |
| Data                | PostgreSQL 18, Drizzle ORM, tenant scope with composite keys, transactional outbox |
| Realtime            | Bun WebSockets, Postgres `LISTEN/NOTIFY`, outbox relay worker                      |
| Web                 | Vite, React 19, TanStack Router and Query, React Aria Components, Tailwind CSS v4  |

The reasoning behind each choice is in [`docs/adr`](docs/adr/README.md).

## Running it

Requirements: [Bun](https://bun.sh) 1.4+ and Docker.

```bash
bun install
cp .env.example .env
bun run infra:up     # postgres, s3-compatible storage, mailpit
bun run db:migrate
bun run dev          # api on :4000, web on :5173, outbox worker
```

Open http://localhost:5173 and create an account. Emails (verification codes, invitations) land in Mailpit at
http://localhost:8035.

```bash
bun run db:seed      # optional: a demo workspace with six weeks of history
bun run check        # biome, typecheck and every test suite — what CI runs
```

The seed signs you in as `demo@teamflow.dev` with the password `teamflow-demo`.

## Documentation

[`docs/`](docs/README.md) has the vision, architecture, roadmap, conventions and decision records.
`AGENTS.md` is the short version for contributors and coding agents.

## License

[MIT](LICENSE)
