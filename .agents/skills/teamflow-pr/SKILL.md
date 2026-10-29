---

name: teamflow-pr
description: Ship a change in the TeamFlow repo as a small, reviewable pull request into dev — branch naming, commit slicing, checks, PR description. Use whenever starting, committing or opening a PR for TeamFlow work.
---

# Shipping a TeamFlow change

## 1. Branch

```bash
git checkout dev && git pull
git checkout -b <type>/<short-kebab-topic>   # feat|fix|chore|docs|refactor|test
```

One concern per branch. If the work naturally splits (schema, then service, then UI), make it several PRs.

## 2. Commit in slices

Each commit compiles and passes tests on its own and does one thing:

- schema/migration, then domain logic + tests, then procedure + integration test, then UI.
- Message: `type(scope): imperative summary in lowercase` — scopes are listed in `commitlint.config.ts`.
- The body (optional) explains _why_, not what.
- No co-author trailers. No mention of tools used to produce the change.

## 3. Check before pushing

```bash
bun run check        # biome + typecheck + tests
```

If you touched `packages/db/src/schema`, also run `bun run db:generate` and commit the SQL migration.

## 4. Open the PR

```bash
git push -u origin HEAD
gh pr create --base dev --title "<type>(<scope>): <summary>" --body "<what changed and why, bullet list>"
```

The description lists the user-visible change, notable design choices (link the ADR if one applies) and how it
was tested. Same rule as commits: describe the work, not the tooling.

## 5. Merge

Squash-merge once CI is green. Delete the branch. `main` is only updated by release PRs from `dev`.
