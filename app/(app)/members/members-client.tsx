'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

export default function MembersClient({
  currentUser,
  members,
}: {
  currentUser: User
  members: MemberWithStats[]
}) {
  const router = useRouter()
  const tCommon = useTranslations('common')
  const tMembers = useTranslations('members')
  const [isPending, startTransition] = useTransition()

  const roleOptions = [
    { value: 'member', label: tMembers('roleMember') },
    { value: 'admin', label: tMembers('roleAdmin') },
  ]
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'member'>('member')
  const [confirmDelete, setConfirmDelete] = useState<MemberWithStats | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<MemberWithStats | null>(null)

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

  function runSoftRemove() {
    if (!confirmRemove) return
    startTransition(async () => {
      const result = await removeMember(confirmRemove.id)
      if (!result.ok) { setError(result.error); setConfirmRemove(null); return }
      setConfirmRemove(null)
      router.refresh()
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
          {error} <button className="underline ml-2" onClick={() => setError(null)}>{tCommon('dismiss')}</button>
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
                        <Button disabled={isPending} onClick={() => copyMagicLink(u.id)}>{tMembers('copyMagicLink')}</Button>
                      ) : null}
                      <Button disabled={isPending} onClick={() => startEdit(u)}>{tCommon('edit')}</Button>
                      {canHardDelete ? (
                        <Button variant="danger" disabled={isPending} onClick={() => setConfirmDelete(u)}>
                          {tCommon('deleteForever')}
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={isPending || isSelf}
                          onClick={() => setConfirmRemove(u)}
                        >
                          {tCommon('remove')}
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
                {isEditing ? (
                  <div className="bevel-in bg-y2k-chrome-100 flex flex-col gap-2 p-3">
                    <TextInput
                      label={tMembers('fieldDisplayName')}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <TextInput
                      label={`${tMembers('fieldEmail')} ${tCommon('optional')}`}
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                    <Select
                      label={tMembers('fieldRole')}
                      options={roleOptions}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'admin' | 'member')}
                      disabled={isSelf}
                    />
                    {isSelf ? (
                      <p className="text-xs text-y2k-chrome-700">{tMembers('cannotChangeOwnRole')}</p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button variant="primary" disabled={isPending} onClick={saveEdit}>
                        {isPending ? tCommon('saving') : tCommon('save')}
                      </Button>
                      <Button disabled={isPending} onClick={cancelEdit}>{tCommon('cancel')}</Button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Window>

      <Dialog open={!!magicLink} title={tMembers('magicLinkReady')} onClose={() => setMagicLink(null)}>
        <p className="mb-2">{tMembers('magicLinkSendBlurb')}</p>
        <code className="block bevel-in bg-white p-2 break-all text-xs mb-3">{magicLink}</code>
        <div className="flex justify-end gap-2">
          <Button onClick={() => { if (magicLink) navigator.clipboard?.writeText(magicLink) }}>{tCommon('copy')}</Button>
          <Button onClick={() => setMagicLink(null)}>{tCommon('done')}</Button>
        </div>
      </Dialog>

      <Dialog
        open={!!confirmRemove}
        title="Remove member?"
        onClose={() => setConfirmRemove(null)}
      >
        <p className="mb-3">
          Remove <strong>{confirmRemove?.displayName}</strong>? Their history stays in the ledger, but they can&apos;t sign in and won&apos;t appear in pickers. You can restore them later by clearing <code>removed_at</code> in the database.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmRemove(null)}>{tCommon('cancel')}</Button>
          <Button variant="danger" disabled={isPending} onClick={runSoftRemove}>
            {isPending ? tCommon('removing') : tCommon('remove')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!confirmDelete}
        title={tCommon('deleteForeverConfirm')}
        onClose={() => setConfirmDelete(null)}
      >
        <p className="mb-3">
          Delete <strong>{confirmDelete?.displayName}</strong>? {tCommon('cannotBeUndone')}
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(null)}>{tCommon('cancel')}</Button>
          <Button variant="danger" disabled={isPending} onClick={confirmHardDelete}>
            {isPending ? tCommon('deleting') : tCommon('deleteForever')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
