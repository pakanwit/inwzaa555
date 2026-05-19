'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

export function StatusBar({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <footer
      className={clsx(
        'bevel-out bg-y2k-chrome-200 flex items-center justify-between gap-2 px-2 py-1 text-xs',
        className,
      )}
    >
      <div className="bevel-in bg-y2k-chrome-100 px-2 py-0.5 flex-1 truncate">
        {children ?? 'Ready'}
      </div>
      <div className="bevel-in bg-y2k-chrome-100 px-2 py-0.5">{time}</div>
    </footer>
  );
}
