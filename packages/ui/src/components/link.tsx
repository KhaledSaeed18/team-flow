import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
  composeRenderProps,
} from 'react-aria-components';

export function TextLink({ className, ...props }: AriaLinkProps) {
  return (
    <AriaLink
      {...props}
      className={composeRenderProps(
        className,
        (className) =>
          `focus-ring rounded-[2px] text-ink underline decoration-line-strong underline-offset-2 data-[hovered]:decoration-ink ${className ?? ''}`,
      )}
    />
  );
}
