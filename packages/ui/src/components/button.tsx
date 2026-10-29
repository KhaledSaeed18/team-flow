import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  composeRenderProps,
} from 'react-aria-components';
import { tv, type VariantProps } from 'tailwind-variants';

export const button = tv({
  base: [
    'focus-ring inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium',
    'rounded-control transition-colors duration-100',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  ],
  variants: {
    variant: {
      primary: 'bg-ink text-canvas data-[hovered]:bg-ink/85 data-[pressed]:bg-ink/75',
      secondary:
        'border border-line bg-surface text-ink data-[hovered]:border-line-strong data-[pressed]:bg-raised',
      quiet: 'text-ink-muted data-[hovered]:bg-lane data-[hovered]:text-ink data-[pressed]:bg-line',
      danger: 'bg-danger text-white data-[hovered]:bg-danger/90',
    },
    size: {
      sm: 'h-7 px-2 text-xs',
      md: 'h-8 px-3 text-sm',
      lg: 'h-10 px-4 text-sm',
      icon: 'size-8 text-base',
    },
  },
  defaultVariants: { variant: 'secondary', size: 'md' },
});

export interface ButtonProps extends AriaButtonProps, VariantProps<typeof button> {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(className, (className) => button({ variant, size, className }))}
    />
  );
}
