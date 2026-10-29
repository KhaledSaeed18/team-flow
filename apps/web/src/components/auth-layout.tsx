import type { ReactNode } from 'react';
import { Logo } from './logo.tsx';

/**
 * Auth screens: the form on the left, and on wide screens a small, static planning wall — the thing the product
 * is about, rather than a stock illustration.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="my-auto w-full py-12">
          <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-muted text-sm leading-relaxed">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <aside aria-hidden className="hidden overflow-hidden border-line border-l bg-lane lg:block">
        <MiniWall />
      </aside>
    </div>
  );
}

const WALL = [
  {
    lane: 'Todo',
    cards: [
      ['TF-118', 'Invite flow copy review'],
      ['TF-121', 'Empty state for the backlog'],
    ],
  },
  {
    lane: 'In Progress',
    cards: [
      ['TF-112', 'Drag cards between lanes with the keyboard'],
      ['TF-116', 'Presence avatars on the board'],
    ],
  },
  {
    lane: 'Done',
    cards: [
      ['TF-104', 'Fractional ranks for ordering'],
      ['TF-97', 'Burndown from the activity log'],
    ],
  },
] as const;

function MiniWall() {
  return (
    <div className="flex h-full -rotate-3 items-center gap-4 pl-16 opacity-90">
      {WALL.map((column, columnIndex) => (
        <div key={column.lane} className="w-60 shrink-0 rounded-lane bg-canvas p-3">
          <p className="px-1 pb-2 font-medium text-ink-muted text-xs">{column.lane}</p>
          <div className="flex flex-col gap-2">
            {column.cards.map(([id, title], cardIndex) => {
              const focused = columnIndex === 1 && cardIndex === 0;
              return (
                <div
                  key={id}
                  className={`rounded-card border bg-surface p-3 ${
                    focused
                      ? 'border-marigold shadow-lifted outline-2 outline-marigold outline-offset-2'
                      : 'border-line'
                  }`}
                >
                  <p className="text-2xs text-ink-faint">{id}</p>
                  <p className="mt-1 text-ink text-sm leading-snug">{title}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
