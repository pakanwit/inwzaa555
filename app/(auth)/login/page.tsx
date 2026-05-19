'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { Marquee } from '@/components/y2k/marquee';
import { useMockStore } from '@/lib/mock/store';
import { useAuth } from '@/lib/mock/auth-context';

export default function LoginPage() {
  const users = useMockStore((s) => s.users);
  const { signInAs } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const match = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && !u.removedAt,
    );
    if (!match) {
      setError('No invite found for this email. Ask an admin for a link.');
      return;
    }
    setSent(true);
    setTimeout(() => {
      signInAs(match.id);
      router.push('/');
    }, 600);
  }

  return (
    <main className="p-6 max-w-md mx-auto mt-8">
      <Marquee>
        Welcome to TripKitty 2003!!! Best viewed in Internet Explorer 6.
      </Marquee>
      <div className="h-3" />
      <Window title="Sign in to TripKitty">
        <form onSubmit={send} className="flex flex-col gap-3">
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={sent}
          />
          {error ? <p className="text-y2k-magenta">{error}</p> : null}
          {sent ? (
            <p>
              Magic link sent (mock). Signing you in…
            </p>
          ) : (
            <Button variant="primary" type="submit">
              Send magic link
            </Button>
          )}
        </form>
        <p className="mt-4 text-xs">
          Mock mode: any seed user email works (e.g. <code>pak@example.com</code>).
        </p>
      </Window>
    </main>
  );
}
