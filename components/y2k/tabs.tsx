'use client';
import { useState } from 'react';
import clsx from 'clsx';

type Tab = { id: string; label: string; content: React.ReactNode };

export function Tabs({
  tabs,
  defaultId,
}: {
  tabs: Tab[];
  defaultId?: string;
}) {
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id);
  return (
    <div>
      <div role="tablist" className="flex gap-0.5 -mb-px">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={clsx(
                'px-3 py-1 bevel-out bg-y2k-chrome-200',
                'rounded-t-sm border-b-0',
                isActive
                  ? 'font-bold relative z-10'
                  : 'opacity-80',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="bevel-out bg-y2k-chrome-200 p-3">
        {tabs.find((t) => t.id === active)?.content}
      </div>
    </div>
  );
}
