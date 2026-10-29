# 0009 — A Vite SPA with TanStack Router and Query instead of an SSR framework

- Status: Accepted
- Date: 2026-10-29

## Context

The workspace is behind a login, highly interactive and real-time; SEO does not apply. Server rendering would add a
second server runtime between the browser and the API with little benefit.

## Decision

- `apps/web` is a static SPA: **Vite**, **React 19**, **TanStack Router** (file-based, type-safe search params),
  **TanStack Query** (via oRPC utils), **TanStack Table + Virtual** for lists, **dnd-kit** for drag and drop,
  **Tailwind v4** with in-repo components in `packages/ui`.
- Public, indexable pages live in `apps/site` (Astro), which ships near-zero JavaScript.

## Consequences

- The SPA deploys as static files to any CDN; the api is the only server.
- Route loaders prefetch queries so navigation is instant.
