'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import clsx from 'clsx'
import { LocaleToggle } from '@/components/locale-toggle'
import { StatusBar } from '@/components/y2k/status-bar'
import type { AppLocale } from '@/i18n/request'
import type { User } from '@/lib/types'

export function AppShell({
  children,
  currentUser,
  locale,
}: {
  children: React.ReactNode
  currentUser: User
  locale: AppLocale
}) {
  const pathname = usePathname()
  const t = useTranslations('nav')

  const nav = [
    { href: '/', label: t('home') },
    { href: '/expenses', label: 'Expenses' },
    { href: '/contributions', label: 'Pot' },
    { href: '/members', label: 'Members' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <nav
        className="bevel-out bg-y2k-chrome-200 px-2 py-1 flex flex-wrap gap-1 items-center"
        aria-label="Primary"
      >
        <strong className="mr-2">inwzaa555</strong>
        {nav.map((n) => {
          const active = pathname === n.href
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'bevel-out bg-y2k-chrome-100 px-2 py-0.5 no-underline text-black',
                active && 'font-bold bevel-in',
              )}
            >
              {n.label}
            </Link>
          )
        })}
        <LocaleToggle current={locale} className="ml-auto" />
        <span className="text-xs">
          {t('signedInAs', { name: currentUser.displayName })}
        </span>
      </nav>
      <main className="flex-1 p-3 md:p-6 max-w-3xl w-full mx-auto">{children}</main>
      <StatusBar className="m-2">
        Hello {currentUser.displayName} ({currentUser.role})
      </StatusBar>
    </div>
  )
}
