'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { Badge } from '@/components/y2k/badge'
import { Dialog } from '@/components/y2k/dialog'
import { can } from '@/lib/permissions'
import { promoteToAdmin, demoteToMember, removeMember, generateMagicLink } from '@/lib/actions/members'
import type { User } from '@/lib/types'

export default function MembersClient({ currentUser, members }: { currentUser: User; members: User[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = can(currentUser, 'invite.create')

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn()
      if (!result.ok && result.error) setError(result.error)
      else router.refresh()
    })
  }

  async function copyMagicLink(userId: string) {
    startTransition(async () => {
      const result = await generateMagicLink(userId)
      if (result.ok) setMagicLink(result.link)
      else setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-y2k-magenta text-sm bevel-in bg-white p-2">{error} <button className="underline ml-2" onClick={() => setError(null)}>dismiss</button></p>
      ) : null}
      <Window title="Members">
        <ul className="space-y-1">
          {members.map((u) => (
            <li key={u.id} className="bevel-in bg-white p-2 flex items-center gap-2 flex-wrap">
              <strong className={u.removedAt ? 'line-through' : ''}>{u.displayName}</strong>
              <span className="text-xs text-y2k-chrome-700">{u.email}</span>
              {u.role === 'admin' ? <Badge tone="admin">admin</Badge> : <Badge>member</Badge>}
              {u.removedAt ? <Badge tone="warning">removed</Badge> : null}
              {isAdmin && !u.removedAt ? (
                <div className="ml-auto flex gap-1 flex-wrap">
                  <Button disabled={isPending} onClick={() => copyMagicLink(u.id)}>Copy magic link</Button>
                  {u.role === 'member' ? (
                    <Button disabled={isPending} onClick={() => act(() => promoteToAdmin(u.id))}>Make admin</Button>
                  ) : (
                    <Button disabled={isPending || u.id === currentUser.id} onClick={() => act(() => demoteToMember(u.id))}>Demote</Button>
                  )}
                  <Button variant="danger" disabled={isPending || u.id === currentUser.id} onClick={() => act(() => removeMember(u.id))}>Remove</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Window>

      <Dialog open={!!magicLink} title="Magic link ready" onClose={() => setMagicLink(null)}>
        <p className="mb-2">Send this link to your friend:</p>
        <code className="block bevel-in bg-white p-2 break-all text-xs mb-3">{magicLink}</code>
        <div className="flex justify-end gap-2">
          <Button onClick={() => { if (magicLink) navigator.clipboard?.writeText(magicLink) }}>Copy</Button>
          <Button onClick={() => setMagicLink(null)}>Done</Button>
        </div>
      </Dialog>
    </div>
  )
}
