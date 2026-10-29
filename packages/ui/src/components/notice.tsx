import type { ReactNode } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';

const notice = tv({
  base: 'rounded-control border px-3 py-2 text-sm',
  variants: {
    tone: {
      danger: 'border-danger/30 bg-danger-soft text-danger',
      info: 'border-line bg-raised text-ink-muted',
    },
  },
  defaultVariants: { tone: 'info' },
});

export interface NoticeProps extends VariantProps<typeof notice> {
  children: ReactNode;
  className?: string;
}

/** An inline message about the surrounding form or view. Danger notices are announced to screen readers. */
export function Notice({ tone, children, className }: NoticeProps) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={notice({ tone, className })}>
      {children}
    </div>
  );
}
