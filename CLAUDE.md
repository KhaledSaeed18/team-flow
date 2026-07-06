# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TeamFlow is a multi-tenant Agile workspace **backend API** (NestJS 11 + Prisma 7 + PostgreSQL). Multiple organizations operate in full data isolation, each with projects → sprints → tasks, plus memberships, invitations, comments, attachments, labels, notifications, and an immutable audit log. There is no frontend in this repo.

## Commands

The package manager is **pnpm** (do not use npm/yarn).

```bash
pnpm start:dev          # run with watch (dev)
pnpm build              # nest build → dist/
pnpm type-check         # tsc --noEmit (run this after changes; CI enforces it)
pnpm lint               # eslint --fix over {src,apps,libs,test}
pnpm format             # prettier --write src

pnpm test               # jest (unit; *.spec.ts under src/)
pnpm test:watch
pnpm test:cov
pnpm test:e2e           # jest with test/jest-e2e.json
# run a single test file:
pnpm test -- src/modules/tasks/tasks.service.spec.ts
# run tests matching a name:
pnpm test -- -t "should create a task"

pnpm prisma:generate    # regenerate client into src/generated/prisma (REQUIRED after schema edits)
pnpm prisma:migrate     # migrate dev
pnpm prisma:db:seed     # seed (tsx prisma/seed.ts)
pnpm prisma:studio
```

CI (`.github/workflows/ci.yml`) runs on Node 22 and gates PRs to `main`/`dev` with: prisma generate → type-check → lint → build. Match all four locally before pushing. Pre-commit hooks run via Husky.

## Architecture

### Request pipeline (global, wired in `src/main.ts` + `src/app.module.ts`)
Helmet → CORS → **ValidationPipe** (`whitelist`, `forbidNonWhitelisted`, `transform`) → **ThrottlerGuard** (global) → **JwtAuthGuard** (global) → route guards → controller → **TransformInterceptor** wraps every response as `{ data, meta: { timestamp } }` → **GlobalExceptionFilter** normalizes errors. All routes are under the `/api` global prefix; Swagger is served at `/api/docs`.

### Auth & authorization (the core of multi-tenancy — read `src/common/guards/` first)
- **`JwtAuthGuard`** is registered globally (`APP_GUARD`). Every route requires a valid JWT **unless** marked with `@Public()`. It attaches the decoded `JwtPayload` to `request.user`.
- **`OrgMemberGuard`** and **`RolesGuard`** are applied per-controller/route via `@UseGuards(...)`. Both resolve the tenant (`orgId`) from the request, then verify the user's `Membership` in that org. `SUPER_ADMIN` global role bypasses both.
- **Org resolution is implicit and shared** between `OrgMemberGuard` and `RolesGuard` (their `resolveOrgId` methods are near-duplicates): it derives the org from `:orgId`, else from `:projectId` (via Project), else from `:taskId` (via Task), else from a generic `:id` (org or label). Resolved values are stashed on the request (`projectOrgId`, `taskOrgId`, `taskProjectId`, `labelOrgId`) for downstream use by the audit interceptor. When adding routes with new param shapes, extend this resolution logic.
- **Roles** use a hierarchy: `OWNER(4) > ADMIN(3) > MEMBER(2) > VIEWER(1)`. `@Roles(...)` requires the *minimum* of the listed roles. Access requires membership `role` level ≥ that minimum.

### Audit logging (decorator-driven, opt-in)
Annotate a controller method with `@AuditLog({ entity: 'Task' })`. The `AuditLogInterceptor` (see `src/common/interceptors/audit-log.interceptor.ts`) then: infers the action from the HTTP method (POST→CREATE, PATCH/PUT→UPDATE, DELETE→DELETE), fetches a **before** snapshot for mutating actions by dynamically resolving the Prisma model delegate from the entity name, captures **after** from the response, strips sensitive fields (`password`, `token`, `refreshToken`), and writes the log **fire-and-forget** (never blocks or fails the response). Org/project IDs come from the guard-resolved request values above.

### Modules (`src/modules/*`)
Each feature is a standard Nest module (`*.module.ts` / `*.controller.ts` / `*.service.ts`, with `dto/` and `entities/`): `auth`, `users`, `organizations`, `memberships`, `invitations`, `projects`, `sprints`, `tasks`, `comments`, `attachments`, `labels`, `notifications`, `audit-logs`, `email`, `cron`. Controllers are thin (Swagger decorators + guards + DTO binding); business logic and all Prisma access live in services.

- **`cron`** (`@nestjs/schedule`): scheduled jobs for invitation expiry, task due-soon/overdue alerts, and token cleanup (`src/modules/cron/jobs/`).
- **`email`**: transactional email via Resend.
- **`attachments`**: file upload via UploadThing — the route handler is mounted directly on the Express instance in `main.ts` at `/api/uploadthing`, **outside** the Nest router.
- **`notifications`**: in-app + real-time via Server-Sent Events (SSE).

### Data layer
- Prisma schema: `prisma/schema.prisma` (18 models). Connects to PostgreSQL via the `@prisma/adapter-pg` driver adapter. Prisma config lives in `prisma.config.ts`, not `package.json`.
- **The generated client is committed at `src/generated/prisma/`** (output redirected there). Import enums from `src/generated/prisma/enums` and models from `src/generated/prisma/models`. **Re-run `pnpm prisma:generate` after any schema change** or the build/types will be stale.
- `PrismaService` (`src/database/`) is the injectable client; inject it into services.
- **Soft deletes**: organizations, projects, tasks, and comments use a `deletedAt` column. Queries must filter `deletedAt: null` (the guards already do this when resolving tenants) — follow the existing pattern rather than hard-deleting.

### Config
Typed config via `@nestjs/config` `registerAs` factories in `src/config/` (`app`, `database`, `jwt`, `resend`, `throttler`), loaded globally in `app.module.ts` and read with `configService.get<XConfig>('x')`. Env helpers `requireEnv`/`optionalEnv` in `src/config/env.ts`. See `.env.example` for required variables.

## Conventions
- Prettier: **4-space indent**, single quotes, trailing commas (`all`). TypeScript strict-ish (`strictNullChecks` on, `noImplicitAny` off). Match the existing style; run `pnpm format` / `pnpm lint`.
- New endpoints: decorate with Swagger (`@ApiTags`, `@ApiOperation`, response decorators) as existing controllers do — the live docs are generated from these.
- Mark unauthenticated routes with `@Public()`; get the current user with `@CurrentUser()`; guard tenant routes with `OrgMemberGuard`/`RolesGuard`; audit mutations with `@AuditLog()`.
- Branching: work off `dev`; PRs target `main`.
