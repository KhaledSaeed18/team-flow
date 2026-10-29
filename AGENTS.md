# Agent guide

Instructions for coding agents (and humans) working in this repository. Read this first, then the spec in
`docs/`: `VISION.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `ROADMAP.md` and the ADRs in `docs/adr/`. They are the
working spec. If something here or there is wrong, say so and fix it in its own PR — do not silently diverge.

## What this is

TeamFlow v2: a real-time, keyboard-first agile workspace. Bun + Turborepo monorepo.

| Path                | What                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `apps/api`          | Hono on Bun: oRPC procedures, Better Auth routes, WebSocket gateway |
| `apps/worker`       | pg-boss consumers: outbox relay, email delivery, hourly digests     |
| `apps/web`          | Vite + React SPA: TanStack Router/Query, Tailwind v4                |
| `apps/site`         | Astro marketing site and Starlight docs                             |
| `packages/contract` | oRPC contract and Zod schemas — the single source of wire shapes    |
| `packages/db`       | Drizzle schema, migrations, seed, tenant `Scope`                    |
| `packages/domain`   | Pure logic, no I/O: workflows, ordering, metrics                    |
| `packages/auth`     | Better Auth config and shared access-control statements             |

## Commands

```bash
bun install                 # install everything (never npm/pnpm/yarn)
bun run infra:up            # postgres, s3-compatible storage, mailpit
bun run dev                 # all apps in watch mode
bun run check               # biome + typecheck + tests (what CI runs)
bun run lint:fix            # biome autofix
bunx turbo run test --filter=@teamflow/domain   # one package
```

## Non-negotiables

1. **Tenancy.** Tenant-owned tables are only queried through `Scope` (`packages/db`). Never accept an
   `organizationId` from input; it comes from the session. Every tenant table has `organization_id`, a unique
   `(organization_id, id)`, composite foreign keys and an isolation test. See ADR-0004.
2. **Contract first.** Every procedure is declared in `packages/contract` before it is implemented. Never hand-write
   a type the contract can infer.
3. **Layering.** handler → service → `Scope`/repository. Handlers hold no rules; services do authorization on loaded
   resources; only `packages/db` imports table objects.
4. **One transaction per mutation** carrying the change, its `activity` rows and its `outbox` events. No email,
   HTTP or realtime publishing inside it.
5. **Optimistic concurrency.** Mutable aggregates carry `version`; a stale write is `CONFLICT`.
6. **Strict TypeScript.** No `any`, no `!` outside tests, unknown input narrowed by Zod.
7. **Tests with the change.** Branching domain/service logic gets unit tests in the same PR; API behaviour gets
   integration tests against real Postgres; tests never sleep (inject `Clock`).
8. **The web app never imports `@teamflow/db`.** All data goes through the API.

## Workflow

- Branch from `dev` (`feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `test/…`). PRs target `dev` and are
  squash-merged; `main` only receives releases.
- Small batches: one concern per PR, several small commits per PR.
- Conventional Commits with a scope from `commitlint.config.ts`, e.g. `feat(api): move tasks between columns`.
- Commit messages and PR descriptions describe the change and its reason. They carry no co-author trailers and no
  references to tools used to write the code.
- Before pushing: `bun run check`.

## Skills

Project skills live in `.agents/skills/` (also visible as `.claude/skills/`). Use them for recurring tasks:

- `teamflow-pr` — shipping a change as a small PR
- `teamflow-review` — the review checklist for this codebase
- `teamflow-procedure` — adding an API procedure: contract → repository → service → router → test
- `teamflow-tenant-table` — adding a tenant-owned table with composite keys and a reviewed migration
