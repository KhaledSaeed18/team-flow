export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold text-ink ${className}`}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-ink" />
        <rect x="7" y="8" width="5" height="16" rx="1.5" className="fill-canvas" />
        <rect x="13.5" y="8" width="5" height="11" rx="1.5" className="fill-canvas" />
        <rect x="20" y="8" width="5" height="7" rx="1.5" className="fill-marigold" />
      </svg>
      TeamFlow
    </span>
  );
}
