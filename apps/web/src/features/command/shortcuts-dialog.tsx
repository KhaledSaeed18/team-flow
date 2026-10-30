import { Dialog, Kbd } from '@teamflow/ui';
import { shortcutKeys } from '../../lib/shortcuts.ts';

/** `project`: only inside a project, where there is a board to go to or create a task on. */
export const SHORTCUTS: { combo: string; label: string; where: 'anywhere' | 'project' }[] = [
  { combo: 'mod+k', label: 'Open the command menu', where: 'anywhere' },
  { combo: '/', label: 'Search', where: 'anywhere' },
  { combo: 'g i', label: 'Go to the inbox', where: 'anywhere' },
  { combo: '?', label: 'Show keyboard shortcuts', where: 'anywhere' },
  { combo: 'c', label: 'Create a task', where: 'project' },
  { combo: 'g b', label: 'Go to the board', where: 'project' },
  { combo: 'g l', label: 'Go to the list', where: 'project' },
  { combo: 'g c', label: 'Go to the calendar', where: 'project' },
  { combo: 'g p', label: 'Go to planning', where: 'project' },
];

const ON_A_CARD: { keys: string[]; label: string }[] = [
  { keys: ['↑', '↓', '←', '→'], label: 'Move between cards and into a card' },
  { keys: ['Enter'], label: 'Open the card, or start dragging from its move handle' },
  { keys: ['Tab'], label: 'While dragging: next drop position' },
  { keys: ['Esc'], label: 'Cancel a drag, close the task panel' },
];

export function ShortcutsDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const row = (keys: string[], label: string) => (
    <li key={label} className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span>{label}</span>
      <span className="flex shrink-0 gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
    </li>
  );
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} title="Keyboard shortcuts" width="md">
      <h3 className="font-medium text-ink-muted text-xs">Anywhere</h3>
      <ul className="mt-1 divide-y divide-line">
        {SHORTCUTS.filter((s) => s.where === 'anywhere').map((s) =>
          row(shortcutKeys(s.combo), s.label),
        )}
      </ul>
      <h3 className="mt-4 font-medium text-ink-muted text-xs">In a project</h3>
      <ul className="mt-1 divide-y divide-line">
        {SHORTCUTS.filter((s) => s.where === 'project').map((s) =>
          row(shortcutKeys(s.combo), s.label),
        )}
      </ul>
      <h3 className="mt-4 font-medium text-ink-muted text-xs">On the board</h3>
      <ul className="mt-1 divide-y divide-line">{ON_A_CARD.map((s) => row(s.keys, s.label))}</ul>
    </Dialog>
  );
}
