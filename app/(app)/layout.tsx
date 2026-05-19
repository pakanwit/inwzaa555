'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/mock/auth-context';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { Spinner } from '@/components/y2k/spinner';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !currentUser) {
      router.replace('/login');
    }
  }, [hydrated, currentUser, router]);

  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Spinner label="Loading TripKitty…" />
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen p-6 flex items-start justify-center">
        <div className="max-w-sm w-full mt-12">
          <Window title="Not signed in">
            <p className="mb-3">
              You need to sign in first. Redirecting&hellip;
            </p>
            <Link href="/login">
              <Button variant="primary">Go to sign in →</Button>
            </Link>
          </Window>
        </div>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
