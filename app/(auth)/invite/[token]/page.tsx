'use client';

import { useRouter, useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { useMockStore } from '@/lib/mock/store';
import { useAuth } from '@/lib/mock/auth-context';

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const invites = useMockStore((s) => s.invites);
  const consume = useMockStore((s) => s.consumeInvite);
  const { signInAs } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const status = useMemo(() => {
    const invite = invites.find((i) => i.token === token);
    if (!invite) return 'not-found' as const;
    if (invite.revokedAt) return 'revoked' as const;
    if (invite.usedAt) return 'used' as const;
    if (new Date(invite.expiresAt).getTime() < Date.now())
      return 'expired' as const;
    return 'valid' as const;
  }, [invites, token]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const created = consume(token, {
      email: email.trim(),
      displayName: displayName.trim(),
    });
    if (!created) {
      setError('Invite is no longer valid.');
      return;
    }
    signInAs(created.id);
    router.push('/');
  }

  if (status !== 'valid') {
    return (
      <main className="p-6 max-w-md mx-auto mt-8">
        <Window title="Invite">
          <p>
            This invite is <strong>{status}</strong>. Ask an admin for a new
            link.
          </p>
        </Window>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-md mx-auto mt-8">
      <Window title="Join the trip">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextInput
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          {error ? <p className="text-y2k-magenta">{error}</p> : null}
          <Button variant="primary" type="submit">Accept invite</Button>
        </form>
      </Window>
    </main>
  );
}
