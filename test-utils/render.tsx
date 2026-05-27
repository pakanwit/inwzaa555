import { render, type RenderOptions } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import enCommon from '@/messages/en/common.json'
import enNav from '@/messages/en/nav.json'
import enDashboard from '@/messages/en/dashboard.json'
import enExpenses from '@/messages/en/expenses.json'
import enContributions from '@/messages/en/contributions.json'
import enMembers from '@/messages/en/members.json'
import enAuth from '@/messages/en/auth.json'

const enMessages = {
  common: enCommon,
  nav: enNav,
  dashboard: enDashboard,
  expenses: enExpenses,
  contributions: enContributions,
  members: enMembers,
  auth: enAuth,
}

export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
    options,
  )
}
