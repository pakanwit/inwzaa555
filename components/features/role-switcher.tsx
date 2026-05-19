'use client';

import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';

export function RoleSwitcher() {
  const users = useMockStore((s) => s.users);
  const reset = useMockStore((s) => s.resetToSeed);
  const { currentUser, signInAs, signOut } = useAuth();

  return (
    <div className="fixed bottom-2 right-2 z-50 bevel-out bg-y2k-chrome-200 p-2 text-xs">
      <div className="font-bold mb-1">[dev] view as</div>
      <div className="flex flex-wrap gap-1 mb-1">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => signInAs(u.id)}
            className={`bevel-out px-2 py-0.5 bg-y2k-chrome-100 ${
              currentUser?.id === u.id ? 'font-bold underline' : ''
            }`}
          >
            {u.displayName}
            {u.role === 'admin' ? ' ★' : ''}
            {u.removedAt ? ' ✗' : ''}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={signOut}
          className="bevel-out px-2 py-0.5 bg-y2k-chrome-100"
        >
          sign out
        </button>
        <button
          type="button"
          onClick={reset}
          className="bevel-out px-2 py-0.5 bg-y2k-chrome-100"
        >
          reset seed
        </button>
      </div>
    </div>
  );
}
