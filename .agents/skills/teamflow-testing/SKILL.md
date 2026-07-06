---
name: teamflow-testing
description: Write Jest unit and e2e tests for this TeamFlow NestJS + Prisma backend. Use when adding or updating tests for services, controllers, guards, interceptors, or cron jobs, or when setting up e2e coverage. Covers the repo's testing config, PrismaService mocking, and guard/RBAC testing patterns.
metadata:
  author: TeamFlow
  version: "1.0.0"
  type: project
---

# TeamFlow Testing

Testing conventions for this repository. There are currently no committed tests — follow these patterns to keep new tests consistent.

## Setup & running

- **Runner:** Jest via `ts-jest`. Config for unit tests lives in `package.json` (`jest` key): `rootDir: src`, `testRegex: .*\.spec\.ts$`. E2e config is `test/jest-e2e.json` (`testRegex: .e2e-spec.ts$`).
- **Unit tests** live next to the code they test: `src/modules/tasks/tasks.service.spec.ts`.
- **E2e tests** live in `test/` as `*.e2e-spec.ts`.

```bash
pnpm test                                         # all unit tests
pnpm test -- src/modules/tasks/tasks.service.spec.ts   # single file
pnpm test -- -t "creates a task"                  # by test name
pnpm test:cov                                     # coverage
pnpm test:e2e                                     # e2e suite
```

## Unit-testing a service (the common case)

Services are the only layer with real logic, so they are the priority. Build the module with `Test.createTestingModule` and provide a **mocked `PrismaService`**. Do NOT hit a real database in unit tests.

```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
    let service: TasksService;
    const prisma = {
        task: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        // add only the delegates/methods the test touches
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const moduleRef = await Test.createTestingModule({
            providers: [
                TasksService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();
        service = moduleRef.get(TasksService);
    });

    it('throws NotFoundException when the task is soft-deleted', async () => {
        prisma.task.findFirst.mockResolvedValue(null);
        await expect(service.findOne('missing')).rejects.toThrow(
            'not found',
        );
    });
});
```

Guidance:
- Mock **only** the Prisma delegates and methods the code under test calls — keep the mock minimal and typed loosely (`as unknown as PrismaService` if TS complains).
- Assert on the Nest exceptions the services throw (`NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`).
- Remember the **soft-delete** contract: services filter `deletedAt: null`. Test that soft-deleted rows are treated as absent.

## Testing guards & RBAC

Guards (`JwtAuthGuard`, `OrgMemberGuard`, `RolesGuard`) encode the multi-tenancy rules — they are worth direct tests. Fake the `ExecutionContext`:

```ts
const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => TasksController,
} as unknown as ExecutionContext;
```

Cover: missing/invalid JWT → `UnauthorizedException`; non-member → `ForbiddenException`; `SUPER_ADMIN` bypass returns `true`; role hierarchy (`OWNER>ADMIN>MEMBER>VIEWER`) — a VIEWER must be rejected where `@Roles(MEMBER)` is required. Provide a mocked `PrismaService` for the `membership.findUnique`/org-resolution calls, and a mocked `Reflector` for metadata.

## E2e tests

Bootstrap the app the same way `main.ts` does (global `/api` prefix, `ValidationPipe`, global guards) so behavior matches production, then drive it with `supertest`. Use a dedicated test database and reset it between runs (`pnpm prisma:migrate:reset`). Responses are wrapped by `TransformInterceptor` — assert on `res.body.data`, not the raw entity.

## Checklist for a new service test
- [ ] Happy path returns the expected shape
- [ ] Not-found / soft-deleted → correct exception
- [ ] Permission/ownership violations → `ForbiddenException`
- [ ] Uniqueness/conflict paths → `ConflictException`
- [ ] Prisma mock asserts the `where`/`data` passed (esp. `deletedAt: null` filters)
