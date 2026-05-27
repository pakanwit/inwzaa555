'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type AppLocale } from '@/i18n/request'

export async function setLocale(locale: AppLocale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) return
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
