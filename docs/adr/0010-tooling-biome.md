# 0010 — Biome for lint and format

- Status: Accepted
- Date: 2026-10-29

## Context

ESLint + Prettier per package means many configs and slow hooks.

## Decision

One root `biome.json` lints and formats every package. lefthook runs Biome on staged files and commitlint on the
message; type-checking and tests run in CI through Turborepo. Import boundaries Biome cannot express are enforced by
a small test in `tooling/`.

## Consequences

- Sub-second hooks; one config to read.
