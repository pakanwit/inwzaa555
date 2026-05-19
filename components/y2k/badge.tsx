import clsx from 'clsx';

type Tone = 'neutral' | 'admin' | 'warning' | 'good';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide bevel-out',
        tone === 'neutral' && 'bg-y2k-chrome-200 text-black',
        tone === 'admin' && 'bg-y2k-highlighter text-black',
        tone === 'warning' && 'bg-y2k-magenta text-white',
        tone === 'good' && 'bg-y2k-lime text-black',
      )}
    >
      {children}
    </span>
  );
}
