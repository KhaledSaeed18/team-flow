import type { PresenceMember } from '@teamflow/realtime';
import { Avatar, Tooltip } from '@teamflow/ui';
import { Button } from 'react-aria-components';

/** Deduplicate a member with several tabs open into one entry (the first tab's state wins). */
export function uniqueMembers(members: PresenceMember[]): PresenceMember[] {
  const seen = new Map<string, PresenceMember>();
  for (const member of members) if (!seen.has(member.memberId)) seen.set(member.memberId, member);
  return [...seen.values()];
}

/** Who else is looking at this project right now. */
export function PresenceStack({
  members,
  selfMemberId,
}: {
  members: PresenceMember[];
  selfMemberId: string | null;
}) {
  const others = uniqueMembers(members).filter((m) => m.memberId !== selfMemberId);
  if (others.length === 0) return null;
  const shown = others.slice(0, 4);
  const names = others.map((m) => m.name).join(', ');
  return (
    <Tooltip content={`Also here: ${names}`}>
      <Button
        aria-label={`Also viewing: ${names}`}
        className="focus-ring flex -space-x-1.5 rounded-full"
      >
        {shown.map((member) => (
          <Avatar
            key={member.memberId}
            name={member.name}
            src={member.image}
            size="sm"
            decorative
            className="ring-2 ring-canvas"
          />
        ))}
        {others.length > shown.length && (
          <span className="flex size-6 items-center justify-center rounded-full bg-lane text-2xs text-ink-muted ring-2 ring-canvas">
            +{others.length - shown.length}
          </span>
        )}
      </Button>
    </Tooltip>
  );
}
