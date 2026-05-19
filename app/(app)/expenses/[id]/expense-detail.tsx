'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { Badge } from '@/components/y2k/badge'
import { Dialog } from '@/components/y2k/dialog'
import { formatBaht } from '@/lib/money'
import { can } from '@/lib/permissions'
import { deleteExpense, markExpenseReimbursed } from '@/lib/actions/expenses'
import type { Expense, User } from '@/lib/types'

export default function ExpenseDetail({ expense, users, currentUser }: {
  expense: Expense; users: User[]; currentUser: User
}) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

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
        <div className="flex flex-wrap gap-2 mt-2">
          {fronter && !expense.reimbursedAt && canReimburse ? (
            <Button variant="primary" disabled={isPending} onClick={() => {
              startTransition(async () => { await markExpenseReimbursed(expense.id); router.refresh() })
            }}>
              Mark reimbursed
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
          ) : null}
          <Button onClick={() => router.push('/expenses')}>Back</Button>
        </div>
      </div>
      <Dialog open={confirmDelete} title="Delete expense?" onClose={() => setConfirmDelete(false)}>
        <p className="mb-3">Remove "<strong>{expense.description}</strong>" from the ledger?</p>
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" disabled={isPending} onClick={() => {
            startTransition(async () => { await deleteExpense(expense.id) })
          }}>
            Yes, delete
          </Button>
        </div>
      </Dialog>
    </Window>
  )
}
