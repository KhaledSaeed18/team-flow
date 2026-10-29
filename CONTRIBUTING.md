# Contributing to TeamFlow

Thanks for taking the time to contribute.

## Getting started

Requirements: [Bun](https://bun.sh) 1.4+ and Docker.

```bash
git clone https://github.com/KhaledSaeed18/team-flow.git
cd team-flow
bun install          # also installs the git hooks
cp .env.example .env
bun run infra:up     # postgres, s3-compatible storage, mailpit
bun run dev
```

## Branching

Branch off `dev`; pull requests target `dev` and are squash-merged. `main` only receives release merges.

| Prefix      | When to use                                     |
| ----------- | ----------------------------------------------- |
| `feat/`     | New feature                                     |
| `fix/`      | Bug fix                                         |
| `chore/`    | Maintenance, dependencies, config               |
| `docs/`     | Documentation only                              |
| `refactor/` | Code change that is neither a fix nor a feature |
| `test/`     | Adding or updating tests                        |

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org) with a scope from `commitlint.config.ts`, enforced by a
`commit-msg` hook and in CI:

```
feat(api): move tasks between workflow states
fix(web): keep the board scroll position after a live update
chore(db): index tasks by assignee
```

Lowercase, imperative, subject under 72 characters.

## Pull requests

- One concern per PR, kept small; several focused commits are welcome.
- Describe what changed and why; link the issue (`Closes #42`) and any ADR involved.
- `bun run check` must pass (Biome, typecheck, tests) — CI runs the same.
- New behaviour comes with tests. See [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

## Reporting issues

Search existing issues first and use the templates. For security vulnerabilities see [SECURITY.md](SECURITY.md) — do
not open a public issue.
