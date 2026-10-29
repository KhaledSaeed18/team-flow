import { parseTaskIdentifier } from '@teamflow/domain';
import { sql } from 'drizzle-orm';
import type { Scope } from '../scope.ts';

export interface TaskHit extends Record<string, unknown> {
  id: string;
  number: number;
  title: string;
  project_id: string;
  project_key: string;
  project_name: string;
  project_color: string;
  status_name: string;
  status_category: string;
  score: number;
}

/** `calib enc` → `calib:* & enc:*`: every word must match, each as a prefix, so results appear while typing. */
export function prefixQuery(input: string): string | null {
  const words = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return words.length > 0 ? words.map((w) => `${w}:*`).join(' & ') : null;
}

/**
 * Search live tasks in open projects of the scope's organization.
 *
 * Ranking: an exact identifier (`RF-12`) first; then full-text rank (title weighted above description) plus
 * trigram word similarity on the title, which also catches typos the full-text match misses.
 */
export async function searchTasks(scope: Scope, query: string, limit = 20): Promise<TaskHit[]> {
  const text = query.trim();
  if (!text) return [];
  const tsquery = prefixQuery(text);
  const identifier = parseTaskIdentifier(text);

  // A looser word-similarity threshold than pg_trgm's 0.6 catches common typos; set for this transaction only.
  const rows = await scope.db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('pg_trgm.word_similarity_threshold', '0.4', true)`);
    return tx.execute<TaskHit>(sql`
    select
      t.id, t.number, t.title, t.project_id,
      p.key as project_key, p.name as project_name, p.color as project_color,
      s.name as status_name, s.category::text as status_category,
      (case when ${identifier?.key ?? null}::text = p.key and ${identifier?.number ?? null}::int = t.number
            then 100 else 0 end)
      + coalesce(ts_rank(t.search, ${tsquery ? sql`to_tsquery('simple', ${tsquery})` : sql`null::tsquery`}), 0) * 2
      + word_similarity(${text}, t.title) as score
    from tasks t
    join projects p on p.organization_id = t.organization_id and p.id = t.project_id
    join workflow_statuses s on s.organization_id = t.organization_id and s.id = t.status_id
    where t.organization_id = ${scope.organizationId}
      and t.deleted_at is null
      and p.archived_at is null
      and (
        ${tsquery ? sql`t.search @@ to_tsquery('simple', ${tsquery})` : sql`false`}
        or ${text} <% t.title
        or (${identifier?.key ?? null}::text = p.key and ${identifier?.number ?? null}::int = t.number)
      )
    order by score desc, t.updated_at desc
    limit ${limit}
  `);
  });
  return [...rows];
}
