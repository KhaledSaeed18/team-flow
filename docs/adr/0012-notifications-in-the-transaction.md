# 0012 — Notifications are written in the transaction that causes them

- Status: Accepted
- Date: 2026-10-29
- Amends: [0007](0007-outbox-and-activity-log.md) and ARCHITECTURE "Write path and events", which had the outbox
  relay enqueue notification jobs

## Context

The first plan derived notifications asynchronously: the relay would read each outbox event and enqueue a job that
decided who to notify. That needs the job to reconstruct context the mutation already had (who was assigned, who was
mentioned, who is involved), and it opens a window where an event exists but its notifications do not.

## Decision

- The repository that performs a change inserts its `notifications` rows in the same transaction, using the
  context it already holds (`notify(tx, recipients, kind, data)`), never for the actor.
- It also writes one `notifications.created` outbox event naming the recipients; the gateway delivers it to each
  recipient's personal `me` channel, which the server keys by member id.
- Rows carry denormalised display data (identifier, title, excerpt) so the inbox reads without joins.
- Asynchronous work (email digests of unread notifications) is still a job, scheduled by the worker.

## Consequences

- A notification exists if and only if its cause committed.
- Recipient rules live next to the change they belong to and are tested with it.
- Mutations that notify do slightly more work in their transaction; the inserts are batched per kind.
