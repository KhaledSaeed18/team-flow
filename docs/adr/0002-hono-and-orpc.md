# 0002 — Hono for HTTP, oRPC contract-first procedures for the API

- Status: Accepted
- Date: 2026-10-29

## Context

v1 used NestJS controllers, class-validator DTOs and Swagger decorators: three descriptions of every endpoint that
could drift apart, and no types on the client. v2 has a first-party SPA and also wants a documented public API.

## Decision

- **Hono** is the HTTP layer: middleware, auth routes, webhooks, health checks, WebSocket upgrade.
- **oRPC** in contract-first mode: `packages/contract` declares every procedure (input, output, errors, OpenAPI
  route metadata) with Zod; `apps/api` implements the contract; `apps/web` gets a typed client and TanStack Query
  helpers from the same contract.
- The OpenAPI document is generated from the contract and served at `/api/openapi.json`, with a reference UI at
  `/api/docs`.
- Procedures are grouped by domain router (`tasks.create`, `tasks.move`, …) and mounted under `/rpc` for the SPA
  and `/api/v1` (REST-shaped routes from the same contract) for third parties.

## Consequences

- A breaking wire change is a type error in the web app before it is a bug.
- No decorators and no DI container: dependencies are passed explicitly through the context and service factories,
  which keeps services trivially unit-testable.
