# 0001 — Bun runtime and workspaces, orchestrated by Turborepo

- Status: Accepted
- Date: 2026-10-29

## Context

v1 was a single NestJS package on Node + pnpm. v2 has four deployables and several shared packages. We want fast
installs, TypeScript executed without a build step in development, a built-in test runner, and a native WebSocket
server for the real-time layer.

## Decision

- **Bun** is the runtime for `api` and `worker`, the package manager (workspaces) and the unit/integration test
  runner (`bun test`).
- **Turborepo** orchestrates tasks (`lint`, `typecheck`, `test`, `build`) with caching and the package graph.
- Packages are consumed as TypeScript source (`"exports"` pointing at `src`), so there is no per-package build in
  development; only deployables build.

## Consequences

- One tool replaces node, pnpm, tsx, nodemon and jest/vitest for server code.
- The web app still builds with Vite (which runs fine under Bun); Playwright runs under Node in CI where needed.
- Some Node-only libraries may misbehave under Bun; any such case is recorded here with its workaround.
