import * as Y from 'yjs';

/** The Tiptap/ProseMirror fragment name the editor binds to. */
export const FRAGMENT = 'default';

/** Plain text of a description document: one line per block, for search, previews and history. */
export function plainText(doc: Y.Doc): string {
  const lines: string[] = [];
  const walk = (node: Y.XmlElement | Y.XmlText | Y.XmlFragment): string => {
    if (node instanceof Y.XmlText) return node.toString().replace(/<[^>]+>/g, '');
    return node
      .toArray()
      .map((child) => walk(child as Y.XmlElement | Y.XmlText))
      .join('');
  };
  for (const block of doc.getXmlFragment(FRAGMENT).toArray()) {
    if (
      block instanceof Y.XmlElement &&
      (block.nodeName === 'bulletList' || block.nodeName === 'orderedList')
    ) {
      for (const item of block.toArray()) lines.push(`- ${walk(item as Y.XmlElement)}`);
    } else {
      lines.push(walk(block as Y.XmlElement | Y.XmlText));
    }
  }
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const paragraphs = (text: string) =>
  text.split('\n').map((line) => {
    const paragraph = new Y.XmlElement('paragraph');
    if (line) paragraph.insert(0, [new Y.XmlText(line)]);
    return paragraph;
  });

/** A new document holding existing plain text, one paragraph per line, so older descriptions carry over. */
export function seedFromText(doc: Y.Doc, text: string): void {
  if (!text.trim()) return;
  const fragment = doc.getXmlFragment(FRAGMENT);
  doc.transact(() => {
    fragment.insert(0, paragraphs(text));
  }, 'seed');
}

/**
 * Replace the whole description with plain text, as an ordinary edit (so connected editors receive it). Used when
 * the description is changed outside the editor, through the API.
 */
export function replaceText(doc: Y.Doc, text: string, origin: unknown): void {
  const fragment = doc.getXmlFragment(FRAGMENT);
  doc.transact(() => {
    fragment.delete(0, fragment.length);
    if (text.trim()) fragment.insert(0, paragraphs(text));
  }, origin);
}
