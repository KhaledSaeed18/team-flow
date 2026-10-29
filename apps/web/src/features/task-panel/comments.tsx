import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Outputs } from '@teamflow/contract';
import { Avatar, Button, toast } from '@teamflow/ui';
import { type KeyboardEvent, useId, useMemo, useRef, useState } from 'react';
import { orpc } from '../../lib/api.ts';
import { meQuery } from '../../lib/session.ts';
import { Reactions } from './reactions.tsx';

type Member = Outputs['members']['list'][number];
type Comment = Outputs['comments']['list'][number];

const time = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Render `@Name` tokens for mentioned members as emphasised text. */
function Body({ comment, members }: { comment: Comment; members: Member[] }) {
  const names = members.filter((m) => comment.mentions.includes(m.id)).map((m) => `@${m.name}`);
  if (names.length === 0) return <>{comment.body}</>;
  const pattern = new RegExp(
    `(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  );
  return (
    <>
      {comment.body.split(pattern).map((part, i) =>
        names.includes(part) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: split parts have no identity beyond position
          <strong key={i} className="font-medium text-ink">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function Comments({ taskId }: { taskId: string }) {
  const comments = useQuery(orpc.comments.list.queryOptions({ input: { taskId } }));
  const members = useQuery(orpc.members.list.queryOptions());
  const me = useQuery(meQuery());

  return (
    <div className="flex flex-col gap-4">
      {comments.data?.length === 0 && <p className="text-ink-faint text-xs">No comments yet.</p>}
      <ol className="flex flex-col gap-4">
        {comments.data?.map((comment) => (
          <li key={comment.id} className="flex gap-2.5">
            <Avatar
              name={comment.authorName ?? 'Former member'}
              src={comment.authorImage}
              size="sm"
              decorative
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-medium">{comment.authorName ?? 'Former member'}</span>{' '}
                <time className="text-ink-faint" dateTime={comment.createdAt.toISOString()}>
                  {time.format(comment.createdAt)}
                  {comment.editedAt && ' (edited)'}
                </time>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-ink-muted text-sm leading-relaxed">
                <Body comment={comment} members={members.data ?? []} />
              </p>
              <Reactions comment={comment} taskId={taskId} myName={me.data?.user.name ?? ''} />
            </div>
          </li>
        ))}
      </ol>
      <Composer taskId={taskId} members={members.data ?? []} />
    </div>
  );
}

/**
 * A comment box with an @mention picker: typing `@` and a few letters suggests members; ↑/↓ choose, Enter or Tab
 * inserts, Escape dismisses. Mentions are sent as member ids for every `@Name` still present when posting.
 */
function Composer({ taskId, members }: { taskId: string; members: Member[] }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const listId = useId();

  const suggestions = useMemo(
    () =>
      query
        ? members.filter((m) => m.name.toLowerCase().includes(query.text.toLowerCase())).slice(0, 6)
        : [],
    [members, query],
  );

  const post = useMutation(
    orpc.comments.create.mutationOptions({
      onSuccess: () => {
        setBody('');
        void queryClient.invalidateQueries({
          queryKey: orpc.comments.list.key({ input: { taskId } }),
        });
      },
      onError: (error) =>
        toast({ title: 'Comment not posted', description: error.message, tone: 'danger' }),
    }),
  );

  const detect = (value: string, caret: number) => {
    const match = /(^|\s)@([^\s@]{0,30})$/.exec(value.slice(0, caret));
    setQuery(match ? { start: caret - (match[2]?.length ?? 0) - 1, text: match[2] ?? '' } : null);
    setActive(0);
  };

  const insert = (member: Member) => {
    if (!query) return;
    const before = body.slice(0, query.start);
    const after = body.slice(query.start + 1 + query.text.length);
    const next = `${before}@${member.name} ${after}`;
    setBody(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const caret = before.length + member.name.length + 2;
      textarea.current?.setSelectionRange(caret, caret);
    });
  };

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    const mentions = members.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id);
    post.mutate({ taskId, body: text, mentions });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(
          (i) =>
            (i + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const member = suggestions[active];
        if (member) insert(member);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
    // Leave the box with the draft intact; the next Escape closes the panel.
    if (event.key === 'Escape') event.currentTarget.blur();
  };

  return (
    <div className="relative">
      <textarea
        ref={textarea}
        aria-label="Write a comment"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={suggestions.length > 0 ? `${listId}-${active}` : undefined}
        value={body}
        placeholder="Write a comment. Type @ to mention someone."
        onChange={(event) => {
          setBody(event.target.value);
          detect(event.target.value, event.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className="min-h-20 w-full resize-y rounded-control border border-line bg-surface px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-marigold"
      />
      {suggestions.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Mention someone"
          className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-card border border-line bg-surface p-1 shadow-lifted"
        >
          {suggestions.map((member, i) => (
            <div
              key={member.id}
              id={`${listId}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              onMouseDown={(event) => {
                event.preventDefault();
                insert(member);
              }}
              className={`flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm ${
                i === active ? 'bg-lane' : ''
              }`}
            >
              <Avatar name={member.name} src={member.image} size="xs" decorative />
              {member.name}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-ink-faint text-xs">⌘ Enter to post</span>
        <Button
          size="sm"
          variant="primary"
          isPending={post.isPending}
          isDisabled={!body.trim()}
          onPress={submit}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}
