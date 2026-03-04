# Contributing to TeamFlow

Thanks for taking the time to contribute! Here's everything you need to know.

---

## Getting Started

1. Fork the repository
2. Clone your fork
```bash
   git clone https://github.com/KhaledSaeed18/team-flow.git
   cd teamflow
```
3. Install dependencies
```bash
   pnpm install
```
4. Copy the environment file and configure it
```bash
   cp .env.example .env
```
5. Run database migrations
```bash
   pnpm prisma:migrate
```
6. Start the development server
```bash
   pnpm start:dev
```

---

## Branching

Always branch off `main`. Use the following naming convention:

| Prefix | When to use |
| ------ | ----------- |
| `feat/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Maintenance, dependencies, config |
| `docs/` | Documentation only |
| `refactor/` | Code change that isn't a fix or feature |
| `test/` | Adding or updating tests |

**Examples**
```
feat/task-dependency-api
fix/refresh-token-expiry
docs/update-contributing
chore/upgrade-prisma
```

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org) standard.
```
<type>(optional scope): short description

feat(tasks): add subtask support
fix(auth): handle expired refresh token edge case
chore(deps): upgrade nestjs to latest
docs(readme): add setup instructions
refactor(sprints): simplify status transition logic
test(tasks): add unit tests for task number generation
```

**Rules:**
- Use lowercase
- Present tense — "add feature" not "added feature"
- Keep the subject line under 72 characters
- Reference issues when relevant: `fix(auth): handle token expiry (#42)`

---

## Pull Requests

- One PR per feature or fix — keep it focused
- Open a PR against `main`
- Fill in the PR description — what changed and why
- Link the related issue if one exists: `Closes #42`
- Make sure the project builds and lints before submitting
```bash
pnpm lint
pnpm build
```

---

## Reporting Issues

- Search existing issues before opening a new one
- Use the issue templates if available
- For security vulnerabilities, see [SECURITY.md](./SECURITY.md) — do not open a public issue

---

## Code Style

- TypeScript strict mode — no `any`
- Follow the existing module structure in `src/modules/`
- Keep services and controllers thin — business logic lives in the service layer
- Prisma queries go inside services, never in controllers

---

That's it. Keep it clean, keep it focused, and thank you for contributing to TeamFlow 🚀
