'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/mock/auth-context';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) router.replace('/login');
  }, [currentUser, router]);

  if (!currentUser) {
    return (
      <main className="min-h-screen p-6 flex items-start justify-center">
        <div className="max-w-sm w-full mt-12">
          <Window title="Not signed in">
            <p className="mb-3">
              You need to sign in first.
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
