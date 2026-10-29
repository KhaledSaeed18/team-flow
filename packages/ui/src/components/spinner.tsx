export function Spinner({
  label = 'Loading',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className={`inline-flex items-center ${className}`}>
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-line border-t-ink-muted"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
