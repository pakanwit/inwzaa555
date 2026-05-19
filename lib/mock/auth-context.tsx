'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useMockStore } from './store';
import type { User } from './types';

const ACTIVE_USER_KEY = 'trip-kitty-active-user';

type Ctx = {
  currentUser: User | null;
  signInAs: (userId: string) => void;
  signOut: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const users = useMockStore((s) => s.users);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem(ACTIVE_USER_KEY));
    setHydrated(true);
  }, []);

  const signInAs = (id: string) => {
    localStorage.setItem(ACTIVE_USER_KEY, id);
    setCurrentUserId(id);
  };
  const signOut = () => {
    localStorage.removeItem(ACTIVE_USER_KEY);
    setCurrentUserId(null);
  };

  const currentUser =
    hydrated && currentUserId
      ? users.find((u) => u.id === currentUserId && !u.removedAt) ?? null
      : null;

  return (
    <AuthCtx.Provider value={{ currentUser, signInAs, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside MockAuthProvider');
  return ctx;
}
