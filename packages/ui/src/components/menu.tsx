import type { ReactNode } from 'react';
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps,
  type MenuProps,
  Popover,
  type PopoverProps,
  Separator,
} from 'react-aria-components';

export { MenuTrigger, SubmenuTrigger } from 'react-aria-components';

export const popover =
  'min-w-48 overflow-auto rounded-card border border-line bg-surface p-1 shadow-lifted outline-none data-[entering]:animate-fade-in';

export function Menu<T extends object>({
  placement,
  ...props
}: MenuProps<T> & { placement?: PopoverProps['placement'] }) {
  return (
    <Popover placement={placement ?? 'bottom start'} className={popover}>
      <AriaMenu {...props} className="outline-none" />
    </Popover>
  );
}

export interface ItemProps extends MenuItemProps {
  icon?: ReactNode;
  shortcut?: ReactNode;
  tone?: 'default' | 'danger';
}

export function MenuItem({ icon, shortcut, tone = 'default', children, ...props }: ItemProps) {
  const textValue = props.textValue ?? (typeof children === 'string' ? children : undefined);
  return (
    <AriaMenuItem
      {...props}
      textValue={textValue}
      className={`flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm outline-none data-[focused]:bg-lane data-[disabled]:opacity-50 ${
        tone === 'danger' ? 'text-danger' : 'text-ink'
      }`}
    >
      {(state) => (
        <>
          {icon && (
            <span className="flex size-4 items-center justify-center text-ink-muted">{icon}</span>
          )}
          <span className="flex-1 truncate">
            {typeof children === 'function' ? children(state) : children}
          </span>
          {shortcut && <span className="flex gap-0.5">{shortcut}</span>}
        </>
      )}
    </AriaMenuItem>
  );
}

export function MenuSeparator() {
  return <Separator className="mx-1 my-1 border-line border-t" />;
}
