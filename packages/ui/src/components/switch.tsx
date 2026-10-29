import { Switch as AriaSwitch, type SwitchProps } from 'react-aria-components';

export function Switch({ children, ...props }: SwitchProps & { children: React.ReactNode }) {
  return (
    <AriaSwitch
      {...props}
      className="group flex cursor-default items-center gap-2 text-ink-muted text-sm"
    >
      <span className="flex h-5 w-8 shrink-0 items-center rounded-full border border-line bg-lane px-0.5 transition-colors group-data-[selected]:border-ink group-data-[selected]:bg-ink group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-marigold group-data-[focus-visible]:outline-offset-2">
        <span className="size-3.5 rounded-full bg-surface shadow-sm transition-transform group-data-[selected]:translate-x-3" />
      </span>
      {children}
    </AriaSwitch>
  );
}
