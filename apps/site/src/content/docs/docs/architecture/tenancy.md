---
title: Tenancy
description: Many workspaces, one schema, and why a wrong query still cannot leak.
sidebar:
  order: 2
---

All workspaces share one schema. Every workspace-owned table has an `organization_id`, and isolation is enforced
in the application by construction, not by remembering to add a `where`.

- **The organization comes from the session, never from input.** Procedures receive a `Scope` for the active
  organization, and repositories take a `Scope`, not an id.
- **Composite keys.** Every tenant table has a unique `(organization_id, id)`, and references between tenant tables
  are composite foreign keys. A task cannot point at a label in another workspace, even through a buggy query,
  because the database rejects the row.
- **The schema is tested, not trusted.** A test walks the Drizzle schema and fails if any tenant table lacks the
  column, the composite key, or the foreign key to organizations. Indexes lead with `organization_id`, except a
  short, commented list of deliberate cross-tenant lookups (a user's own memberships, the outbox relay, a token
  looked up by its hash).
- **Isolation suites.** Integration tests for every feature include another workspace trying to read and write
  the same records, and getting a 404.

Why not Postgres row-level security? It hides tenancy inside the database, where it is harder to test and
reason about from the code. This project's sibling, PatchGrid, takes the RLS route on purpose. The two projects
compare the trade-offs.
