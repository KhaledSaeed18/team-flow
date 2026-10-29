import { CaretDown } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import {
  Select as AriaSelect,
  type SelectProps as AriaSelectProps,
  Button,
  Label,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  Popover,
  SelectValue,
} from 'react-aria-components';
import { popover } from './menu.tsx';

export interface SelectProps<T extends object> extends Omit<AriaSelectProps<T>, 'children'> {
  label?: ReactNode;
  items?: Iterable<T>;
  children: ReactNode | ((item: T) => ReactNode);
}

export function Select<T extends object>({ label, items, children, ...props }: SelectProps<T>) {
  return (
    <AriaSelect {...props} className="flex flex-col gap-1.5">
      {label && <Label className="font-medium text-sm">{label}</Label>}
      <Button className="focus-ring flex h-9 items-center justify-between gap-2 rounded-control border border-line bg-surface px-2.5 text-left text-sm data-[hovered]:border-line-strong">
        <SelectValue className="flex min-w-0 items-center gap-2 truncate data-[placeholder]:text-ink-faint" />
        <CaretDown aria-hidden className="text-ink-muted" />
      </Button>
      <Popover className={`${popover} w-(--trigger-width)`}>
        <ListBox items={items} className="outline-none">
          {children}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

export function SelectItem(props: ListBoxItemProps) {
  return (
    <ListBoxItem
      {...props}
      className="flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm outline-none data-[focused]:bg-lane data-[selected]:font-medium"
    />
  );
}
