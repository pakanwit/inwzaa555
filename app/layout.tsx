import type { Metadata } from 'next';
import { Pixelify_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const pixelify = Pixelify_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-pixelify',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'The Rich Boys — Trip Kitty',
  description: 'A very serious financial system for a 2D1N trip.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={pixelify.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
