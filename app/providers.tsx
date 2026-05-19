'use client';
import { MockAuthProvider } from '@/lib/mock/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <MockAuthProvider>{children}</MockAuthProvider>;
}
