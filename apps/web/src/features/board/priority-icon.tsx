import {
  CellSignalHigh,
  CellSignalLow,
  CellSignalMedium,
  WarningOctagon,
} from '@phosphor-icons/react';
import type { Priority } from '@teamflow/domain';

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
  none: 'No priority',
};

export function PriorityIcon({ priority }: { priority: Priority }) {
  const label = PRIORITY_LABEL[priority];
  switch (priority) {
    case 'urgent':
      return <WarningOctagon weight="fill" className="text-danger" aria-label={label} />;
    case 'high':
      return <CellSignalHigh weight="bold" className="text-ink" aria-label={label} />;
    case 'medium':
      return <CellSignalMedium weight="bold" className="text-ink-muted" aria-label={label} />;
    case 'low':
      return <CellSignalLow weight="bold" className="text-ink-faint" aria-label={label} />;
    case 'none':
      return null;
  }
}
