---
name: teamflow-endpoint
description: Scaffold a new API endpoint or feature module in this TeamFlow NestJS backend following the repo's conventions. Use when adding a route, controller, service, DTO, or entity, or a whole feature module. Covers guards, RBAC, audit logging, Swagger docs, multi-tenant org resolution, and the response envelope.
metadata:
  author: TeamFlow
  version: "1.0.0"
  type: project
---

# TeamFlow Endpoint / Module

How to add endpoints so they match the existing modules under `src/modules/*`. Read one neighbor module (e.g. `tasks`) before starting.

## Module layout

```
src/modules/<feature>/
  <feature>.module.ts       # declares controller + service, imports what it needs
  <feature>.controller.ts   # thin: routing, guards, Swagger, DTO binding only
  <feature>.service.ts      # ALL business logic + the only place PrismaService is used
  dto/                      # class-validator DTOs, barrel-exported via index.ts
  entities/                 # Swagger response shapes, barrel-exported
```
Register the module in `src/app.module.ts` `imports`. Inject `PrismaService` into the service (it's provided by the global `PrismaModule`).

## Controller rules

- Keep controllers thin — no business logic, no direct Prisma access.
- Auth is **global** (`JwtAuthGuard` is an `APP_GUARD`), so every route requires a JWT unless you add `@Public()`.
- Get the caller with `@CurrentUser() user: JwtPayload`.
- Decorate with Swagger — the live `/api/docs` is generated from these: `@ApiTags`, `@ApiBearerAuth('access-token')`, `@ApiOperation`, `@ApiParam`, `@ApiBody`, and the `@Api*Response` decorators. Copy the density of an existing controller.
- Validation is automatic (global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`) — every body param must be a class-validator DTO or it will be stripped/rejected.

## Multi-tenancy & RBAC (do not skip)

Any route that touches org-scoped data must guard the tenant:

```ts
@UseGuards(OrgMemberGuard)                 // caller must be a member of the org
@Roles(MembershipRole.ADMIN)               // + minimum role (used with RolesGuard)
@UseGuards(OrgMemberGuard, RolesGuard)
```

- The guards resolve the org from the route params **in this order**: `:orgId` → `:projectId` (via Project) → `:taskId` (via Task) → generic `:id` (org or label). If you introduce a route whose org can't be derived from those params, extend `resolveOrgId` in **both** `src/common/guards/org-member.guard.ts` and `roles.guard.ts` (they mirror each other).
- Role hierarchy: `OWNER(4) > ADMIN(3) > MEMBER(2) > VIEWER(1)`; `@Roles(X)` means "X or higher". `SUPER_ADMIN` global role bypasses both guards.
- Nest new resources under their parent for automatic org resolution, e.g. `@Controller('projects/:projectId/tasks')`.

## Audit logging

Add `@AuditLog({ entity: 'Task' })` to mutating handlers (POST/PATCH/DELETE). The `AuditLogInterceptor` auto-detects the action from the HTTP method, snapshots before/after, redacts sensitive fields, and writes fire-and-forget. Use `idParam` if the entity id isn't `:id`, and `action` to override (e.g. `ARCHIVE`, `RESTORE`, `ASSIGN`).

## Data & responses

- **Soft deletes:** organizations, projects, tasks, comments use `deletedAt`. Filter `deletedAt: null` on reads and set `deletedAt` instead of hard-deleting.
- Import enums from `src/generated/prisma/enums` and model types from `src/generated/prisma/models` (the client is generated into `src/generated/prisma`). After any `prisma/schema.prisma` change, run `pnpm prisma:generate`.
- Every response is auto-wrapped by `TransformInterceptor` as `{ data, meta: { timestamp } }` — return the raw entity/DTO from the controller; don't wrap it yourself.

## Skeleton

```ts
@ApiTags('Widgets')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/widgets')
export class WidgetsController {
    constructor(private readonly widgets: WidgetsService) {}

    @Post()
    @UseGuards(OrgMemberGuard, RolesGuard)
    @Roles(MembershipRole.MEMBER)
    @AuditLog({ entity: 'Widget' })
    @ApiOperation({ summary: 'Create a widget' })
    @ApiCreatedResponse({ type: WidgetEntity })
    create(
        @Param('projectId') projectId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateWidgetDto,
    ) {
        return this.widgets.create(projectId, user.sub, dto);
    }
}
```

## Before you finish
Run `pnpm type-check && pnpm lint && pnpm build` (the CI gates). Add Swagger response decorators for every status the endpoint can return.
