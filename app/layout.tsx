import type { Metadata } from 'next';
import { Audiowide, Chakra_Petch } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Providers } from './providers';

const audiowide = Audiowide({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-audiowide',
  display: 'swap',
});

const chakra = Chakra_Petch({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-chakra',
  display: 'swap',
});

// Co-locate Vercel functions with Supabase (ap-southeast-1 = Singapore)
export const preferredRegion = 'sin1'

export const metadata: Metadata = {
  title: 'inwzaa555',
  description: 'A very serious financial system for the Rich Boys 2D1N trip.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${audiowide.variable} ${chakra.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
