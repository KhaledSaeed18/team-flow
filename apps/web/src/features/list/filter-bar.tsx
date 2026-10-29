import { CaretDown, X } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { activeFacets, ME, PRIORITIES, type TaskFilter, UNASSIGNED } from '@teamflow/domain';
import { Avatar, Button, popover } from '@teamflow/ui';
import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  ListBox,
  ListBoxItem,
  Popover,
} from 'react-aria-components';
import { orpc } from '../../lib/api.ts';
import { PRIORITY_LABEL, PriorityIcon } from '../board/priority-icon.tsx';
import type { Project } from '../tasks.ts';

type Facet = 'assignee' | 'priority' | 'label' | 'status';
interface Option {
  id: string;
  label: string;
  icon?: ReactNode;
}

/** Facet pickers for the list: each opens a multi-select; values within a facet are "any of". */
export function FilterBar({
  project,
  filter,
  onChange,
}: {
  project: Project;
  filter: TaskFilter;
  onChange: (patch: Partial<TaskFilter>) => void;
}) {
  const members = useQuery(orpc.members.list.queryOptions());
  const labels = useQuery(orpc.labels.list.queryOptions({ input: { projectId: project.id } }));

  const facets: { facet: Facet; label: string; options: Option[] }[] = [
    {
      facet: 'assignee',
      label: 'Assignee',
      options: [
        { id: ME, label: 'Me' },
        { id: UNASSIGNED, label: 'Unassigned' },
        ...(members.data ?? []).map((m) => ({
          id: m.id,
          label: m.name,
          icon: <Avatar name={m.name} src={m.image} size="xs" decorative />,
        })),
      ],
    },
    {
      facet: 'priority',
      label: 'Priority',
      options: PRIORITIES.map((p) => ({
        id: p,
        label: PRIORITY_LABEL[p],
        icon: <PriorityIcon priority={p} />,
      })),
    },
    {
      facet: 'label',
      label: 'Label',
      options: (labels.data ?? []).map((l) => ({
        id: l.id,
        label: l.name,
        icon: <Dot color={l.color} />,
      })),
    },
    {
      facet: 'status',
      label: 'Status',
      options: project.statuses.map((s) => ({
        id: s.id,
        label: s.name,
        icon: <Dot color={s.color} />,
      })),
    },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {facets.map(({ facet, label, options }) => (
        <FacetPicker
          key={facet}
          label={label}
          options={options}
          selected={(filter[facet] as string[] | undefined) ?? []}
          onChange={(values) => onChange({ [facet]: values.length ? values : undefined })}
        />
      ))}
      {activeFacets(filter) > 0 && (
        <Button
          variant="quiet"
          size="sm"
          onPress={() =>
            onChange({
              assignee: undefined,
              priority: undefined,
              label: undefined,
              status: undefined,
            })
          }
        >
          <X /> Clear
        </Button>
      )}
    </div>
  );
}

const Dot = ({ color }: { color: string }) => (
  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
);

function FacetPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const chosen = options.filter((o) => selected.includes(o.id));
  const summary =
    chosen.length === 0 ? null : chosen.length === 1 ? chosen[0]?.label : `${chosen.length}`;
  return (
    <DialogTrigger>
      <AriaButton
        aria-label={summary ? `${label}: ${chosen.map((o) => o.label).join(', ')}` : label}
        className={`focus-ring flex h-7 items-center gap-1.5 rounded-control border px-2 text-xs data-[hovered]:border-line-strong ${
          summary
            ? 'border-line-strong bg-raised text-ink'
            : 'border-line bg-surface text-ink-muted'
        }`}
      >
        {label}
        {summary && <span className="max-w-28 truncate font-medium">{summary}</span>}
        <CaretDown aria-hidden className="text-ink-faint" />
      </AriaButton>
      <Popover placement="bottom start" className={`${popover} min-w-48`}>
        <Dialog aria-label={label} className="outline-none">
          {options.length === 0 ? (
            <p className="p-2 text-ink-muted text-xs">Nothing to filter by yet.</p>
          ) : (
            <ListBox
              aria-label={label}
              selectionMode="multiple"
              selectedKeys={selected}
              // Escape closes the picker; it should not also wipe the choices made in it.
              escapeKeyBehavior="none"
              onSelectionChange={(keys) =>
                onChange(keys === 'all' ? options.map((o) => o.id) : [...keys].map(String))
              }
              items={options}
              className="max-h-72 overflow-y-auto outline-none"
            >
              {(option) => (
                <ListBoxItem
                  id={option.id}
                  textValue={option.label}
                  className="flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm outline-none data-[focused]:bg-lane data-[selected]:font-medium"
                >
                  {({ isSelected }) => (
                    <>
                      <span
                        aria-hidden
                        className={`flex size-3.5 items-center justify-center rounded-[3px] border text-[9px] ${
                          isSelected ? 'border-ink bg-ink text-canvas' : 'border-line-strong'
                        }`}
                      >
                        {isSelected && '✓'}
                      </span>
                      {option.icon && (
                        <span className="flex w-4 justify-center">{option.icon}</span>
                      )}
                      <span className="flex-1 truncate">{option.label}</span>
                    </>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
