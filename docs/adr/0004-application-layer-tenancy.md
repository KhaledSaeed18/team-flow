# 0004 — Tenancy enforced by a scoped query layer and composite keys, not RLS

- Status: Accepted
- Date: 2026-10-29

## Context

TeamFlow is multi-tenant: organizations must never see each other's data. Postgres row-level security is one
answer, but it makes every connection stateful (a per-transaction tenant setting), complicates pooling and the
LISTEN/NOTIFY fan-out, and hides the tenant predicate from the query plan reviewer. v1 relied on guards and
discipline, which is the failure mode to avoid.

## Decision

Isolation is enforced by construction in the application layer:

1. **Every tenant-owned table** has `organization_id uuid not null`, a unique `(organization_id, id)` and indexes that
   lead with `organization_id`.
2. **Every foreign key between tenant-owned tables is composite** on `(organization_id, id)`. A wrong query can at
   worst fail; it cannot create a cross-tenant reference.
3. **Tenant tables are reachable only through `Scope`.** `createScope(db, organizationId)` returns query helpers that
   always add the predicate and always set the column on insert. Raw table imports from `@teamflow/db/schema` are
   restricted to `packages/db` by a lint rule and an import-boundary test.
4. **The organization comes from the session**, never from input. Procedures do not accept `organizationId`.
5. **A schema test** walks every Drizzle table and fails if a tenant-owned table lacks the column, the composite
   unique key, or an entry in the cross-tenant isolation suite.

## Consequences

- Plain pooled connections, simple realtime fan-out.
- A bug in `Scope` is a bug for everyone, so `Scope` is small and exhaustively tested.
