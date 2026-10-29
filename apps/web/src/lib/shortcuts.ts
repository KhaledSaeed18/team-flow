import { useEffect, useRef } from 'react';

/**
 * Keyboard shortcuts. A shortcut is a single key (`c`, `?`), a chord (`mod+k`, where mod is ⌘ on macOS and Ctrl
 * elsewhere) or a two-key sequence (`g b`). Single-key shortcuts never fire while the user is typing.
 */

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
    el.getAttribute('role') === 'textbox'
  );
};

function matchesChord(event: KeyboardEvent, chord: string) {
  const parts = chord.toLowerCase().split('+');
  const key = parts.pop();
  const mod = parts.includes('mod');
  return (
    event.key.toLowerCase() === key &&
    (mod ? event.metaKey || event.ctrlKey : !event.metaKey && !event.ctrlKey) &&
    !event.altKey
  );
}

export type Shortcuts = Record<string, (event: KeyboardEvent) => void>;

/** Register shortcuts for as long as the component is mounted. */
export function useShortcuts(shortcuts: Shortcuts, enabled = true) {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;
    let pending: { key: string; at: number } | null = null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const entries = Object.entries(latest.current);

      for (const [combo, handler] of entries) {
        if (combo.includes('+') && matchesChord(event, combo)) {
          event.preventDefault();
          handler(event);
          return;
        }
      }
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (pending && Date.now() - pending.at < 1200) {
        const handler = latest.current[`${pending.key} ${key}`];
        pending = null;
        if (handler) {
          event.preventDefault();
          handler(event);
          return;
        }
      }
      if (entries.some(([combo]) => combo.startsWith(`${key} `))) {
        pending = { key, at: Date.now() };
        return;
      }
      const handler = latest.current[event.key === '?' ? '?' : key];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/** Display form: `mod+k` → [⌘, K] on macOS, [Ctrl, K] elsewhere; `g b` → [G, then B]. */
export function shortcutKeys(combo: string): string[] {
  return combo
    .split(/[+ ]/)
    .map((part) =>
      part === 'mod' ? (isMac ? '⌘' : 'Ctrl') : part.length === 1 ? part.toUpperCase() : part,
    );
}
