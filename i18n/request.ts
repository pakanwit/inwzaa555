import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const SUPPORTED_LOCALES = ['en', 'th'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

function isAppLocale(value: string | undefined): value is AppLocale {
  return value === 'en' || value === 'th';
}

async function loadMessages(locale: AppLocale) {
  const [common, nav, dashboard, expenses, contributions, members, auth] =
    await Promise.all([
      import(`../messages/${locale}/common.json`).then((m) => m.default),
      import(`../messages/${locale}/nav.json`).then((m) => m.default),
      import(`../messages/${locale}/dashboard.json`).then((m) => m.default),
      import(`../messages/${locale}/expenses.json`).then((m) => m.default),
      import(`../messages/${locale}/contributions.json`).then((m) => m.default),
      import(`../messages/${locale}/members.json`).then((m) => m.default),
      import(`../messages/${locale}/auth.json`).then((m) => m.default),
    ]);
  return { common, nav, dashboard, expenses, contributions, members, auth };
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
