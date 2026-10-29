import { Smiley } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Outputs, REACTIONS, type Reaction } from '@teamflow/contract';
import { popover, toast } from '@teamflow/ui';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Popover,
  ToggleButton,
} from 'react-aria-components';
import { orpc } from '../../lib/api.ts';

type Comment = Outputs['comments']['list'][number];

export const EMOJI: Record<Reaction, { emoji: string; label: string }> = {
  thumbsup: { emoji: '👍', label: 'Thumbs up' },
  tada: { emoji: '🎉', label: 'Party' },
  heart: { emoji: '❤️', label: 'Heart' },
  smile: { emoji: '😄', label: 'Smile' },
  eyes: { emoji: '👀', label: 'Looking' },
  rocket: { emoji: '🚀', label: 'Rocket' },
};

const people = (names: string[]) =>
  names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;

/** Reaction chips under a comment; pressing one toggles yours. The picker adds a new kind. */
export function Reactions({
  comment,
  taskId,
  myName,
}: {
  comment: Comment;
  taskId: string;
  myName: string;
}) {
  const queryClient = useQueryClient();
  const key = orpc.comments.list.queryKey({ input: { taskId } });
  const react = useMutation(
    orpc.comments.react.mutationOptions({
      // Toggle locally first, so a reaction feels instant; the server's answer replaces it.
      onMutate: async ({ reaction, on }) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData(key);
        queryClient.setQueryData(key, (list) =>
          list?.map((c) => (c.id === comment.id ? toggled(c, reaction, on, myName) : c)),
        );
        return { previous };
      },
      onError: (error, _input, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous);
        toast({ title: 'Reaction not saved', description: error.message, tone: 'danger' });
      },
      onSuccess: (updated) =>
        queryClient.setQueryData(key, (list) =>
          list?.map((c) => (c.id === updated.id ? updated : c)),
        ),
    }),
  );
  const set = (reaction: Reaction, on: boolean) =>
    react.mutate({ commentId: comment.id, reaction, on });

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {comment.reactions.map((r) => (
        <ToggleButton
          key={r.reaction}
          isSelected={r.mine}
          onChange={(on) => set(r.reaction, on)}
          aria-label={`${EMOJI[r.reaction].label}: ${people(r.names)}`}
          className="flex h-6 items-center gap-1 rounded-full border border-line bg-surface px-2 text-xs outline-none data-[hovered]:border-line-strong data-[selected]:border-ink/40 data-[selected]:bg-raised data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
        >
          <span aria-hidden>{EMOJI[r.reaction].emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </ToggleButton>
      ))}
      <DialogTrigger>
        <AriaButton
          aria-label="Add reaction"
          className="flex size-6 items-center justify-center rounded-full text-ink-faint outline-none data-[hovered]:bg-lane data-[hovered]:text-ink data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
        >
          <Smiley />
        </AriaButton>
        <Popover placement="top start" className={popover}>
          <Dialog aria-label="Reactions" className="flex gap-0.5 outline-none">
            {({ close }) =>
              REACTIONS.map((reaction) => {
                const mine = comment.reactions.some((r) => r.reaction === reaction && r.mine);
                return (
                  <AriaButton
                    key={reaction}
                    aria-label={EMOJI[reaction].label}
                    aria-pressed={mine}
                    onPress={() => {
                      set(reaction, !mine);
                      close();
                    }}
                    className="flex size-8 items-center justify-center rounded-control text-base outline-none data-[hovered]:bg-lane data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold aria-pressed:bg-raised"
                  >
                    {EMOJI[reaction].emoji}
                  </AriaButton>
                );
              })
            }
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}

function toggled(comment: Comment, reaction: Reaction, on: boolean, myName: string): Comment {
  const existing = comment.reactions.find((r) => r.reaction === reaction);
  if (on) {
    if (existing?.mine) return comment;
    const next = existing
      ? { ...existing, count: existing.count + 1, mine: true, names: [...existing.names, myName] }
      : { reaction, count: 1, mine: true, names: [myName] };
    return {
      ...comment,
      reactions: existing
        ? comment.reactions.map((r) => (r.reaction === reaction ? next : r))
        : [...comment.reactions, next],
    };
  }
  if (!existing?.mine) return comment;
  const left = {
    ...existing,
    count: existing.count - 1,
    mine: false,
    names: existing.names.filter((n) => n !== myName),
  };
  return {
    ...comment,
    reactions:
      left.count === 0
        ? comment.reactions.filter((r) => r.reaction !== reaction)
        : comment.reactions.map((r) => (r.reaction === reaction ? left : r)),
  };
}
