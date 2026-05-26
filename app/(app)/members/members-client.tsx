'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { Badge } from '@/components/y2k/badge'
import { Dialog } from '@/components/y2k/dialog'
import { TextInput } from '@/components/y2k/text-input'
import { Select } from '@/components/y2k/select'
import { can } from '@/lib/permissions'
import {
  removeMember,
  hardDeleteMember,
  updateMember,
  generateMagicLink,
} from '@/lib/actions/members'
import type { User } from '@/lib/types'
import type { MemberWithStats } from '@/lib/actions/members'

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
]

export default function MembersClient({
  currentUser,
  members,
}: {
  currentUser: User
  members: MemberWithStats[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'member'>('member')
  const [confirmDelete, setConfirmDelete] = useState<MemberWithStats | null>(null)

  const isAdmin = can(currentUser, 'invite.create')

  function startEdit(u: MemberWithStats) {
    setEditingId(u.id)
    setEditName(u.displayName)
    setEditEmail(u.email ?? '')
    setEditRole(u.role)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  function saveEdit() {
    if (!editingId) return
    startTransition(async () => {
      const result = await updateMember({
        id: editingId,
        displayName: editName,
        email: editEmail || undefined,
        role: editRole,
      })
      if (!result.ok) { setError(result.error); return }
      setEditingId(null)
      router.refresh()
    })
  }

  function softRemove(targetId: string) {
    startTransition(async () => {
      const result = await removeMember(targetId)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })
  }

  function confirmHardDelete() {
    if (!confirmDelete) return
    startTransition(async () => {
      const result = await hardDeleteMember(confirmDelete.id)
      if (!result.ok) { setError(result.error); setConfirmDelete(null); return }
      setConfirmDelete(null)
      router.refresh()
    })
  }

  function copyMagicLink(userId: string) {
    startTransition(async () => {
      const result = await generateMagicLink(userId)
      if (result.ok) setMagicLink(result.link)
      else setError(result.error)
    })
  }

  const activeCount = members.filter((m) => !m.removedAt).length
  const removedCount = members.length - activeCount

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-y2k-magenta text-sm bevel-in bg-white p-2">
          {error} <button className="underline ml-2" onClick={() => setError(null)}>dismiss</button>
        </p>
      ) : null}
      <p className="text-xs">
        {activeCount} active {activeCount === 1 ? 'member' : 'members'}
        {removedCount > 0 ? ` · ${removedCount} removed` : ''}
      </p>
      <Window title="Members">
        <ul className="space-y-1">
          {members.map((u) => {
            const isSelf = u.id === currentUser.id
            const isEditing = editingId === u.id
            const canHardDelete = u.referenceCount === 0 && !isSelf
            return (
              <li key={u.id} className="bevel-in bg-white p-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className={u.removedAt ? 'line-through' : ''}>{u.displayName}</strong>
                  {u.email ? <span className="text-xs text-y2k-chrome-700">{u.email}</span> : null}
                  {u.role === 'admin' ? <Badge tone="admin">admin</Badge> : <Badge>member</Badge>}
                  {u.removedAt ? <Badge tone="warning">removed</Badge> : null}
                  {isAdmin && !u.removedAt && !isEditing ? (
                    <div className="ml-auto flex gap-1 flex-wrap">
                      {u.email ? (
                        <Button disabled={isPending} onClick={() => copyMagicLink(u.id)}>Copy magic link</Button>
                      ) : null}
                      <Button disabled={isPending} onClick={() => startEdit(u)}>Edit</Button>
                      {canHardDelete ? (
                        <Button variant="danger" disabled={isPending} onClick={() => setConfirmDelete(u)}>
                          Delete forever
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={isPending || isSelf}
                          onClick={() => softRemove(u.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
                {isEditing ? (
                  <div className="bevel-in bg-y2k-chrome-100 flex flex-col gap-2 p-3">
                    <TextInput
                      label="Display name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <TextInput
                      label="Email (optional)"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                    <Select
                      label="Role"
                      options={ROLE_OPTIONS}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'admin' | 'member')}
                      disabled={isSelf}
                    />
                    {isSelf ? (
                      <p className="text-xs text-y2k-chrome-700">You cannot change your own role.</p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button variant="primary" disabled={isPending} onClick={saveEdit}>
                        {isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button disabled={isPending} onClick={cancelEdit}>Cancel</Button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
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

      <Dialog
        open={!!confirmDelete}
        title="Delete forever?"
        onClose={() => setConfirmDelete(null)}
      >
        <p className="mb-3">
          Delete <strong>{confirmDelete?.displayName}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" disabled={isPending} onClick={confirmHardDelete}>
            {isPending ? 'Deleting…' : 'Delete forever'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
