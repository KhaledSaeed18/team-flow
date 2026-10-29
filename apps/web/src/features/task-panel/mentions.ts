export interface Mention<T> {
  member: T;
  start: number;
  end: number;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where `@Name` mentions occur in a comment. A name only counts as a whole: `@Anna` is not a mention of "Ann", and
 * in `@Jo Smith` the longer name wins over "Jo".
 */
export function findMentions<T extends { name: string }>(text: string, members: readonly T[]) {
  const found: Mention<T>[] = [];
  const longestFirst = [...members].sort((a, b) => b.name.length - a.name.length);
  for (const member of longestFirst) {
    if (!member.name) continue;
    const pattern = new RegExp(`@${escapeRegExp(member.name)}(?![\\p{L}\\p{N}])`, 'gu');
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (found.some((m) => start < m.end && end > m.start)) continue;
      found.push({ member, start, end });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
