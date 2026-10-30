import { type Database, digestCandidates, digestItems, markDigestSent } from '@teamflow/db';
import { digestDue, digestSince } from '@teamflow/domain';
import type { EmailMessage } from '@teamflow/email';

/** The pg-boss queue the hourly digest run is scheduled on. */
export const DIGEST_QUEUE = 'digest.run';

const SHOWN = 10;
const SCANNED = 50;

/**
 * One digest pass: for everyone whose digest is due and who has something unread, enqueue one email. Hourly, so
 * daily and weekly digests go out roughly when the last one did. Returns how many were enqueued.
 */
export async function runDigests({
  db,
  now,
  enqueue,
}: {
  db: Database;
  now: Date;
  enqueue: (message: EmailMessage) => Promise<unknown>;
}): Promise<number> {
  let sent = 0;
  for (const person of await digestCandidates(db, now)) {
    if (person.frequency === 'off' || !digestDue(person.frequency, person.lastSentAt, now))
      continue;
    const since = digestSince(person.lastSentAt, now);
    const items = await digestItems(
      db,
      person.organizationId,
      person.memberId,
      since,
      now,
      SCANNED,
    );
    if (items.length === 0) continue;

    // Marked before enqueueing: a crash in between skips one digest instead of sending it twice.
    await markDigestSent(db, person.organizationId, person.memberId, now);
    await enqueue({
      kind: 'digest',
      to: person.email,
      name: person.name,
      organizationName: person.organizationName,
      frequency: person.frequency,
      items: items.slice(0, SHOWN).map((item) => ({
        kind: item.kind,
        actorName: item.actorName,
        identifier: item.data.identifier ?? '',
        title: item.data.title ?? '',
        ...(item.data.excerpt ? { excerpt: item.data.excerpt } : {}),
      })),
      more: Math.max(0, items.length - SHOWN),
    });
    sent++;
  }
  return sent;
}
