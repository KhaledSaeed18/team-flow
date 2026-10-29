import type { ReactNode } from 'react';

/** A keyboard shortcut hint. Pass each key as a child string: `<Kbd>⌘</Kbd><Kbd>K</Kbd>`. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line border-b-2 bg-surface px-1 font-medium font-sans text-2xs text-ink-muted">
      {children}
    </kbd>
  );
}
