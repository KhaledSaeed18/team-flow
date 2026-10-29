import { Dialog, Kbd } from '@teamflow/ui';
import { shortcutKeys } from '../../lib/shortcuts.ts';

export const SHORTCUTS: { combo: string; label: string }[] = [
  { combo: 'mod+k', label: 'Open the command menu' },
  { combo: '/', label: 'Search' },
  { combo: 'c', label: 'Create a task' },
  { combo: 'g b', label: 'Go to the board' },
  { combo: 'g p', label: 'Go to planning' },
  { combo: 'g i', label: 'Go to the inbox' },
  { combo: '?', label: 'Show keyboard shortcuts' },
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
        {SHORTCUTS.map((s) => row(shortcutKeys(s.combo), s.label))}
      </ul>
      <h3 className="mt-4 font-medium text-ink-muted text-xs">On the board</h3>
      <ul className="mt-1 divide-y divide-line">{ON_A_CARD.map((s) => row(s.keys, s.label))}</ul>
    </Dialog>
  );
}
