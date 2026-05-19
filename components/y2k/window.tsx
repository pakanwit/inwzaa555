import clsx from 'clsx';

type Props = {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
};

export function Window({ title, children, onClose, className }: Props) {
  return (
    <section
      className={clsx(
        'bevel-out bg-y2k-chrome-200 shadow-[2px_2px_0_rgba(0,0,0,0.4)]',
        'max-w-full',
        className,
      )}
    >
      <header
        className="flex items-center justify-between px-1 py-0.5 text-white font-bold"
        style={{
          background:
            'linear-gradient(90deg, var(--color-y2k-blue) 0%, var(--color-y2k-blue-dark) 100%)',
        }}
      >
        <span className="truncate">{title}</span>
        <div className="flex gap-0.5">
          <FakeButton label="_" />
          <FakeButton label="□" />
          {onClose ? (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="bevel-out bg-y2k-chrome-200 text-black w-5 h-4 text-[10px] leading-none"
            >
              ×
            </button>
          ) : (
            <FakeButton label="×" />
          )}
        </div>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function FakeButton({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="bevel-out bg-y2k-chrome-200 text-black w-5 h-4 text-[10px] leading-none inline-flex items-center justify-center select-none"
    >
      {label}
    </span>
  );
}
