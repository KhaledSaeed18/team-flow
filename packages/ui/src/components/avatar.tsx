import { tv, type VariantProps } from 'tailwind-variants';

const avatar = tv({
  base: 'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white',
  variants: {
    size: {
      xs: 'size-5 text-[9px]',
      sm: 'size-6 text-2xs',
      md: 'size-8 text-xs',
      lg: 'size-10 text-sm',
    },
  },
  defaultVariants: { size: 'sm' },
});

// Muted, distinguishable hues; never marigold, which means "focus" in this UI.
const HUES = [
  '#4f6d8f',
  '#5d7d5a',
  '#8a5a7a',
  '#7a6a4f',
  '#4f7f80',
  '#6b5f99',
  '#8f5b4f',
  '#567089',
];

const hueFor = (seed: string) => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return HUES[hash % HUES.length];
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export interface AvatarProps extends VariantProps<typeof avatar> {
  name: string;
  src?: string | null;
  className?: string;
  /** The name is already visible next to it: hide the avatar from assistive technology. */
  decorative?: boolean;
}

export function Avatar({ name, src, size, className, decorative = false }: AvatarProps) {
  return (
    <span
      className={avatar({ size, className })}
      style={{ backgroundColor: hueFor(name) }}
      title={name}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      {!decorative && <span className="sr-only">{name}</span>}
    </span>
  );
}
