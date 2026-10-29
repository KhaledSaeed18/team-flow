import type { ReactNode } from 'react';
import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';

/** Wraps a focusable trigger; shows `content` on hover after a short delay and immediately on keyboard focus. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      {children}
      <AriaTooltip
        offset={6}
        className="flex items-center gap-1.5 rounded-control bg-ink px-2 py-1 text-canvas text-xs shadow-lifted"
      >
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
