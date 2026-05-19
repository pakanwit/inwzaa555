export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1 text-xs"
      aria-live="polite"
    >
      <span className="inline-block w-3 h-3 border-2 border-y2k-chrome-700 border-t-y2k-blue animate-spin" />
      {label}
    </span>
  );
}
