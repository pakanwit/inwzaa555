'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { Badge } from '@/components/y2k/badge'
import { Dialog } from '@/components/y2k/dialog'
import { formatBaht } from '@/lib/money'
import { can } from '@/lib/permissions'
import { deleteExpense, getSignedReceiptDownloadUrl, markExpenseReimbursed } from '@/lib/actions/expenses'
import type { Expense, User } from '@/lib/types'

export default function ExpenseDetail({ expense, users, currentUser }: {
  expense: Expense; users: User[]; currentUser: User
}) {
  const router = useRouter()
  const tCommon = useTranslations('common')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const receipt = expense.attachments[0]
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptLoadError, setReceiptLoadError] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)

  useEffect(() => {
    if (!receipt) return
    let cancelled = false
    setReceiptLoading(true)
    getSignedReceiptDownloadUrl(receipt.storagePath).then((res) => {
      if (cancelled) return
      setReceiptLoading(false)
      if (res.ok) setReceiptUrl(res.url)
      else setReceiptLoadError(res.error)
    })
    return () => { cancelled = true }
  }, [receipt?.storagePath])

  const fronter = expense.frontedByUserId
    ? users.find((u) => u.id === expense.frontedByUserId)
    : null
  const canDelete = can(currentUser, 'expense.delete', { resource: expense })
  const canReimburse = can(currentUser, 'expense.markReimbursed', { resource: expense })

  return (
    <Window title={expense.description}>
      <div className="flex flex-col gap-3">
        <div className="text-3xl font-bold text-y2k-blue">{formatBaht(expense.amountCents)}</div>
        <div className="text-xs flex flex-wrap gap-1 items-center">
          <Badge>{expense.category}</Badge>
          {fronter ? (
            <Badge tone={expense.reimbursedAt ? 'good' : 'warning'}>
              {expense.reimbursedAt ? `Reimbursed to ${fronter.displayName}` : `Fronted by ${fronter.displayName}`}
            </Badge>
          ) : <Badge>Paid from pot</Badge>}
          <span>·</span>
          <span>{new Date(expense.occurredAt).toLocaleDateString()}</span>
        </div>
        {receipt ? (
          <div className="flex flex-col gap-1 mt-2">
            <span className="font-bold">Receipt</span>
            {receiptLoading ? <span className="text-y2k-blue text-sm">{tCommon('loading')}</span> : null}
            {receiptLoadError ? <span className="text-y2k-magenta text-sm">{receiptLoadError}</span> : null}
            {receiptUrl && receipt.mimeType !== 'image/heic' ? (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptUrl} alt="Receipt" className="bevel-in mt-1 max-h-64 w-auto object-contain" />
              </a>
            ) : null}
            {receiptUrl && receipt.mimeType === 'image/heic' ? (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                Open receipt (HEIC)
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-2">
          {fronter && !expense.reimbursedAt && canReimburse ? (
            <Button variant="primary" disabled={isPending} onClick={() => {
              startTransition(async () => { await markExpenseReimbursed(expense.id); router.refresh() })
            }}>
              Mark reimbursed
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>{tCommon('delete')}</Button>
          ) : null}
          <Button onClick={() => router.push('/expenses')}>{tCommon('back')}</Button>
        </div>
      </div>
      <Dialog open={confirmDelete} title="Delete expense?" onClose={() => setConfirmDelete(false)}>
        <p className="mb-3">Remove "<strong>{expense.description}</strong>" from the ledger?</p>
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setConfirmDelete(false)}>{tCommon('cancel')}</Button>
          <Button variant="danger" disabled={isPending} onClick={() => {
            startTransition(async () => { await deleteExpense(expense.id) })
          }}>
            {tCommon('yesDelete')}
          </Button>
        </div>
      </Dialog>
    </Window>
  )
}
