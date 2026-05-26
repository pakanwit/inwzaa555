'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatBaht, parseBahtInput } from '@/lib/money'
import {
  getSignedSlipDownloadUrl,
  updateContribution,
  deleteContribution,
} from '@/lib/actions/contributions'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Select } from '@/components/y2k/select'
import { Dialog } from '@/components/y2k/dialog'
import type { Contribution, User } from '@/lib/types'

export function ContributionRow({
  contribution,
  user,
  members,
  isAdmin,
}: {
  contribution: Contribution
  user?: User
  members: User[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const slip = contribution.attachments[0]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [editUserId, setEditUserId] = useState(contribution.userId)
  const [editAmount, setEditAmount] = useState((contribution.amountCents / 100).toString())
  const [editDate, setEditDate] = useState(contribution.contributedAt.slice(0, 10))
  const [editNote, setEditNote] = useState(contribution.note ?? '')

  const memberOptions = members
    .filter((m) => !m.removedAt || m.id === contribution.userId)
    .map((m) => ({ value: m.id, label: m.displayName }))

  async function openSlip() {
    if (!slip) return
    setError(null)
    setLoading(true)
    const result = await getSignedSlipDownloadUrl(slip.storagePath)
    setLoading(false)
    if (!result.ok) { setError(result.error); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  function saveEdit() {
    if (!parseBahtInput(editAmount)) { setError('Invalid amount'); return }
    startTransition(async () => {
      const result = await updateContribution({
        id: contribution.id,
        userId: editUserId,
        amountBaht: editAmount,
        contributedAt: editDate,
        note: editNote || undefined,
      })
      if (!result.ok) { setError(result.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  function runDelete() {
    startTransition(async () => {
      const result = await deleteContribution(contribution.id)
      if (!result.ok) { setError(result.error); setConfirmDelete(false); return }
      setConfirmDelete(false)
      router.refresh()
    })
  }

  return (
    <li className="bevel-in bg-white p-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <strong>{user?.displayName ?? contribution.userId}</strong>
          <div className="text-xs">
            {new Date(contribution.contributedAt).toLocaleDateString()}
            {contribution.note ? ` · ${contribution.note}` : ''}
          </div>
          {slip ? (
            <button
              type="button"
              onClick={openSlip}
              disabled={loading}
              className="text-xs underline mt-1"
            >
              {loading ? 'Loading…' : 'View slip'}
            </button>
          ) : null}
          {error ? <div className="text-y2k-magenta text-xs">{error}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <strong>{formatBaht(contribution.amountCents)}</strong>
          {isAdmin && !editing ? (
            <div className="flex gap-1">
              <Button onClick={() => setEditing(true)} disabled={isPending}>Edit</Button>
              <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={isPending}>Delete</Button>
            </div>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="bevel-in bg-y2k-chrome-100 flex flex-col gap-2 p-3">
          <Select
            label="Contributor"
            options={memberOptions}
            value={editUserId}
            onChange={(e) => setEditUserId(e.target.value)}
          />
          <div className="grid gap-2 md:grid-cols-2">
            <TextInput
              label="Amount (THB)"
              inputMode="numeric"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
            <TextInput
              label="Date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          <TextInput
            label="Note (optional)"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
          />
          <p className="text-xs text-y2k-chrome-700">Slip image can&apos;t be replaced here — delete and re-add if it&apos;s wrong.</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={saveEdit} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button onClick={() => { setEditing(false); setError(null) }} disabled={isPending}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={confirmDelete}
        title="Delete contribution?"
        onClose={() => setConfirmDelete(false)}
      >
        <p className="mb-3">
          Delete this contribution of <strong>{formatBaht(contribution.amountCents)}</strong> from <strong>{user?.displayName ?? 'unknown'}</strong>? The slip image will also be removed. This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={runDelete} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </li>
  )
}
