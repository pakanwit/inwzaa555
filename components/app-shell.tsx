'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { StatusBar } from '@/components/y2k/status-bar';
import { RoleSwitcher } from '@/components/features/role-switcher';
import { useAuth } from '@/lib/mock/auth-context';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/contributions', label: 'Pot' },
  { href: '/members', label: 'Members' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <nav
        className="bevel-out bg-y2k-chrome-200 px-2 py-1 flex flex-wrap gap-1 items-center"
        aria-label="Primary"
      >
        <strong className="mr-2">Trip Kitty</strong>
        {NAV.map((n) => {
          const active = pathname === n.href;
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
          );
        })}
        <span className="ml-auto text-xs">
          {currentUser ? `Signed in: ${currentUser.displayName}` : 'Not signed in'}
        </span>
      </nav>
      <main className="flex-1 p-3 md:p-6 max-w-3xl w-full mx-auto">{children}</main>
      <StatusBar className="m-2">
        {currentUser
          ? `Hello ${currentUser.displayName} (${currentUser.role})`
          : 'Use the dev switcher to view as a user'}
      </StatusBar>
      <RoleSwitcher />
    </div>
  );
}
