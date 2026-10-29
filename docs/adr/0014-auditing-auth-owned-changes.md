# 0014 — Auditing changes that Better Auth owns

- Status: Accepted
- Date: 2026-10-29

## Context

The audit log is the `activity` table, filtered to entries without a task. Every change TeamFlow makes writes
its activity row in the same transaction as the change (non-negotiable 4, ADR-0007).

Membership, invitations and the workspace record are written by Better Auth's organization plugin, inside its
own transactions. Its `organizationHooks` run afterwards but describe the affected member, not the person who
acted, and they lose what a change destroys (the previous role, a removed person's name).

## Decision

The api wraps Better Auth's handler for the audited endpoints (`invite-member`, `cancel-invitation`,
`accept-invitation`, `update-member-role`, `remove-member`, `leave`, `update`):

- Before the handler runs, it reads the actor from the session and a snapshot of the target.
- After a successful response, it writes one `activity` row (`member.role_changed`, `member.removed`, …).
- If recording fails, the error is logged and the request still succeeds.

## Consequences

- These rows land just after the change, not atomically with it. A crash in between loses an audit line, but
  never the change itself. This is the only exception to rule 4, and it is confined to `apps/api/src/auth-audit.ts`.
- Someone who leaves has no membership afterwards, so their `member.left` row has no actor; the name is in the
  change instead.
- Adding a Better Auth endpoint to the audit means adding one planner to that file.
