import type { Metadata } from 'next';
import { VT323, Orbitron } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const vt323 = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-vt323',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-orbitron',
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
    <html lang="en" className={`${vt323.variable} ${orbitron.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
