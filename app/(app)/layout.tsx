'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/mock/auth-context';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (currentUser === null) {
      // give the auth context a tick to hydrate before redirecting
      const t = setTimeout(() => {
        if (!currentUser) router.replace('/login');
      }, 50);
      return () => clearTimeout(t);
    }
  }, [currentUser, router]);
  if (!currentUser) return null;
  return <AppShell>{children}</AppShell>;
}
