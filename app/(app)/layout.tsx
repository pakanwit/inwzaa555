import { getLocale } from 'next-intl/server'
import { AppShell } from '@/components/app-shell'
import { getUser } from '@/lib/auth/server'
import type { AppLocale } from '@/i18n/request'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, locale] = await Promise.all([getUser(), getLocale()])
  return (
    <AppShell currentUser={user} locale={locale as AppLocale}>
      {children}
    </AppShell>
  )
}
