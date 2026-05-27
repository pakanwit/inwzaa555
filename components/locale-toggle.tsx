'use client'

import { useTransition } from 'react'
import clsx from 'clsx'
import { setLocale } from '@/lib/actions/locale'
import type { AppLocale } from '@/i18n/request'

const LOCALES: { value: AppLocale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'th', label: 'TH' },
]

export function LocaleToggle({
  current,
  className,
}: {
  current: AppLocale
  className?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div
      className={clsx('flex gap-0.5', className)}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => {
        const active = l.value === current
        return (
          <button
            key={l.value}
            type="button"
            disabled={isPending || active}
            onClick={() => {
              if (active) return
              startTransition(() => setLocale(l.value))
            }}
            className={clsx(
              'bevel-out bg-y2k-chrome-100 px-2 py-0.5 text-xs',
              active && 'font-bold bevel-in',
            )}
            aria-pressed={active}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
