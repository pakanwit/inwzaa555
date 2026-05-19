'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useMockStore } from './store';
import type { User } from './types';

const ACTIVE_USER_KEY = 'trip-kitty-active-user';

type Ctx = {
  currentUser: User | null;
  hydrated: boolean;
  signInAs: (userId: string) => void;
  signOut: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const users = useMockStore((s) => s.users);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCurrentUserId(localStorage.getItem(ACTIVE_USER_KEY));
    } catch (err) {
      console.warn('localStorage unavailable, continuing without persisted session', err);
    } finally {
      setHydrated(true);
    }
  }, []);

  const signInAs = (id: string) => {
    try {
      localStorage.setItem(ACTIVE_USER_KEY, id);
    } catch {
      // Best-effort — fall back to in-memory state only
    }
    setCurrentUserId(id);
  };
  const signOut = () => {
    try {
      localStorage.removeItem(ACTIVE_USER_KEY);
    } catch {
      // Best-effort
    }
    setCurrentUserId(null);
  };

  const currentUser =
    hydrated && currentUserId
      ? users.find((u) => u.id === currentUserId && !u.removedAt) ?? null
      : null;

  return (
    <AuthCtx.Provider value={{ currentUser, hydrated, signInAs, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside MockAuthProvider');
  return ctx;
}
