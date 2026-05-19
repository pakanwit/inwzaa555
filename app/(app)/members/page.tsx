'use client';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { Badge } from '@/components/y2k/badge';
import { Dialog } from '@/components/y2k/dialog';
import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';
import { can } from '@/lib/permissions';

export default function MembersPage() {
  const { currentUser } = useAuth();
  const users = useMockStore((s) => s.users);
  const invites = useMockStore((s) => s.invites);
  const createInvite = useMockStore((s) => s.createInvite);
  const revokeInvite = useMockStore((s) => s.revokeInvite);
  const promote = useMockStore((s) => s.promoteToAdmin);
  const demote = useMockStore((s) => s.demoteToMember);
  const remove = useMockStore((s) => s.removeMember);
  const restore = useMockStore((s) => s.restoreMember);
  const [newLink, setNewLink] = useState<string | null>(null);

  if (!currentUser) return null;
  const isAdmin = can(currentUser, 'invite.create');

  function generate() {
    const invite = createInvite(currentUser!.id);
    setNewLink(`${window.location.origin}/invite/${invite.token}`);
  }

  const liveInvites = invites.filter(
    (i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt).getTime() > Date.now(),
  );

  return (
    <div className="space-y-3">
      <Window title="Members">
        <ul className="space-y-1">
          {users.map((u) => (
            <li
              key={u.id}
              className="bevel-in bg-white p-2 flex items-center gap-2 flex-wrap"
            >
              <strong className={u.removedAt ? 'line-through' : ''}>
                {u.displayName}
              </strong>
              <span className="text-xs text-y2k-chrome-700">{u.email}</span>
              {u.role === 'admin' ? <Badge tone="admin">admin</Badge> : <Badge>member</Badge>}
              {u.removedAt ? <Badge tone="warning">removed</Badge> : null}
              {isAdmin ? (
                <div className="ml-auto flex gap-1">
                  {u.role === 'member' ? (
                    <Button onClick={() => promote(u.id)}>Make admin</Button>
                  ) : (
                    <Button
                      onClick={() => demote(u.id)}
                      disabled={u.id === currentUser!.id}
                    >
                      Demote
                    </Button>
                  )}
                  {u.removedAt ? (
                    <Button onClick={() => restore(u.id)}>Restore</Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => remove(u.id)}
                      disabled={u.id === currentUser!.id}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Window>

      {isAdmin ? (
        <Window title="Invite links">
          <div className="flex gap-2 mb-3">
            <Button variant="primary" onClick={generate}>
              Generate invite link
            </Button>
          </div>
          {liveInvites.length === 0 ? (
            <p className="text-xs">No live invite links.</p>
          ) : (
            <ul className="space-y-1">
              {liveInvites.map((i) => {
                const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${i.token}`;
                return (
                  <li
                    key={i.id}
                    className="bevel-in bg-white p-2 flex items-center gap-2 flex-wrap"
                  >
                    <code className="break-all text-xs flex-1">{url}</code>
                    <Button
                      onClick={() => navigator.clipboard?.writeText(url)}
                    >
                      Copy
                    </Button>
                    <Button variant="danger" onClick={() => revokeInvite(i.id)}>
                      Revoke
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Window>
      ) : null}

      <Dialog
        open={!!newLink}
        title="Invite link ready"
        onClose={() => setNewLink(null)}
      >
        <p className="mb-2">Send this link to your friend:</p>
        <code className="block bevel-in bg-white p-2 break-all text-xs mb-3">
          {newLink}
        </code>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              if (newLink) navigator.clipboard?.writeText(newLink);
            }}
          >
            Copy
          </Button>
          <Button onClick={() => setNewLink(null)}>Done</Button>
        </div>
      </Dialog>
    </div>
  );
}
