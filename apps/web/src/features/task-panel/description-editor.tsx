import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

// The same muted hues avatars use, so a person's caret matches their avatar.
const HUES = [
  '#4f6d8f',
  '#5d7d5a',
  '#8a5a7a',
  '#7a6a4f',
  '#4f7f80',
  '#6b5f99',
  '#8f5b4f',
  '#567089',
];
const hueFor = (seed: string) => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return HUES[hash % HUES.length] ?? HUES[0];
};

type Status = 'connecting' | 'live' | 'offline';

/**
 * The task description, edited together: a Tiptap editor bound to the task's Yjs document over y-websocket
 * (ADR-0013). Other editors show as named carets. Read-only for people who cannot edit tasks.
 */
export function DescriptionEditor({
  taskId,
  userName,
  readOnly,
}: {
  taskId: string;
  userName: string;
  readOnly: boolean;
}) {
  // Created in an effect (not a memo) so each mount owns its connection: React's development double mount
  // would otherwise destroy a provider that the remounted component goes on using.
  const [session, setSession] = useState<{ doc: Y.Doc; provider: WebsocketProvider } | null>(null);
  const [status, setStatus] = useState<Status>('connecting');

  useEffect(() => {
    const doc = new Y.Doc();
    const url = new URL('/collab', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const provider = new WebsocketProvider(url.toString(), taskId, doc, { disableBc: true });
    const onStatus = ({ status: s }: { status: string }) =>
      setStatus(s === 'connected' ? 'live' : s === 'connecting' ? 'connecting' : 'offline');
    provider.on('status', onStatus);
    setSession({ doc, provider });
    return () => {
      provider.off('status', onStatus);
      provider.destroy();
      doc.destroy();
      setSession(null);
    };
  }, [taskId]);

  if (!session) return <div className="min-h-24" />;
  return <Editor session={session} userName={userName} readOnly={readOnly} status={status} />;
}

function Editor({
  session: { doc, provider },
  userName,
  readOnly,
  status,
}: {
  session: { doc: Y.Doc; provider: WebsocketProvider };
  userName: string;
  readOnly: boolean;
  status: Status;
}) {
  const editor = useEditor(
    {
      editable: !readOnly,
      extensions: [
        StarterKit.configure({ undoRedo: false, heading: { levels: [2, 3] } }),
        Collaboration.configure({ document: doc }),
        CollaborationCaret.configure({
          provider,
          user: { name: userName, color: hueFor(userName) },
        }),
        Placeholder.configure({ placeholder: readOnly ? 'No description.' : 'Describe the work…' }),
      ],
      editorProps: {
        attributes: {
          'aria-label': 'Description',
          class:
            'tiptap min-h-24 rounded-control px-2 py-1 -mx-2 text-sm leading-relaxed outline-none hover:bg-raised focus:bg-transparent focus-visible:outline-2 focus-visible:outline-marigold',
        },
      },
    },
    [doc, provider, readOnly],
  );

  return (
    <div>
      <EditorContent editor={editor} />
      {status !== 'live' && (
        <p role="status" className="mt-1 text-ink-faint text-xs">
          {status === 'connecting'
            ? 'Connecting the editor…'
            : 'Offline. Your edits will sync when you reconnect.'}
        </p>
      )}
    </div>
  );
}
