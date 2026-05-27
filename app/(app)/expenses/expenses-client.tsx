'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { Select } from '@/components/y2k/select'
import { ExpenseRow } from '@/components/features/expense-row'
import { findFronter } from '@/lib/expense-helpers'
import type { Expense, User, ExpenseCategory } from '@/lib/types'

export default function ExpensesClient({ expenses, users }: { expenses: Expense[]; users: User[] }) {
  const t = useTranslations('expenses')
  const [cat, setCat] = useState<string>('all')
  const [payer, setPayer] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')

  const categories: { value: ExpenseCategory | 'all'; label: string }[] = [
    { value: 'all', label: t('filterCategoryAll') },
    { value: 'food', label: t('categoryFood') },
    { value: 'transport', label: t('categoryTransport') },
    { value: 'lodging', label: t('categoryLodging') },
    { value: 'activity', label: t('categoryActivity') },
    { value: 'other', label: t('categoryOther') },
  ]

  const filtered = expenses
    .filter((e) => cat === 'all' || e.category === cat)
    .filter((e) => {
      if (payer === 'all') return true
      if (payer === 'pot') return !e.frontedByUserId
      return e.frontedByUserId === payer
    })
    .filter((e) => {
      if (status === 'all') return true
      if (status === 'unsettled') return !!e.frontedByUserId && !e.reimbursedAt
      if (status === 'reimbursed') return !!e.reimbursedAt
      if (status === 'pot') return !e.frontedByUserId
      return true
    })

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">Expenses</h1>
        <Link href="/expenses/new"><Button variant="primary">Add expense</Button></Link>
      </div>
      <Window title={t('filtersTitle')}>
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label={t('filterCategoryLabel')}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            options={categories.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Select
            label={t('filterPaidByLabel')}
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            options={[
              { value: 'all', label: t('filterPaidByAnyone') },
              { value: 'pot', label: 'Pot' },
              ...users.map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
          <Select
            label={t('filterStatusLabel')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'all', label: t('filterStatusAll') },
              { value: 'pot', label: t('filterStatusFromPot') },
              { value: 'unsettled', label: t('filterStatusUnsettled') },
              { value: 'reimbursed', label: t('filterStatusReimbursed') },
            ]}
          />
        </div>
      </Window>
      <ul className="space-y-1">
        {filtered.length === 0 ? (
          <li className="text-xs">No expenses match these filters.</li>
        ) : (
          filtered.map((e) => (
            <ExpenseRow key={e.id} expense={e} fronterName={findFronter(users, e)} />
          ))
        )}
      </ul>
    </div>
  )
}
