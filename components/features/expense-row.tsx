'use client'
import { useState } from 'react'
import Link from 'next/link';
import { useTranslations } from 'next-intl'
import { formatBaht } from '@/lib/money';
import { getSignedReceiptDownloadUrl } from '@/lib/actions/expenses'
import type { Expense } from '@/lib/types'
import { Badge } from '@/components/y2k/badge';

export function ExpenseRow({
  expense,
  fronterName,
}: {
  expense: Expense;
  fronterName?: string;
}) {
  const tCommon = useTranslations('common')
  const receipt = expense.attachments[0]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openReceipt(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!receipt) return
    setError(null)
    setLoading(true)
    const result = await getSignedReceiptDownloadUrl(receipt.storagePath)
    setLoading(false)
    if (!result.ok) { setError(result.error); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <li className="bevel-in bg-white p-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <Link
          href={`/expenses/${expense.id}`}
          className="font-bold no-underline text-black hover:underline"
        >
          {expense.description}
        </Link>
        <div className="text-xs flex flex-wrap gap-1 items-center">
          <span>{new Date(expense.occurredAt).toLocaleDateString()}</span>
          <span>·</span>
          <span>{expense.category}</span>
          {expense.frontedByUserId ? (
            <Badge tone={expense.reimbursedAt ? 'good' : 'warning'}>
              {expense.reimbursedAt
                ? `Reimbursed (${fronterName ?? 'paid'})`
                : `Fronted by ${fronterName ?? 'member'}`}
            </Badge>
          ) : (
            <Badge>From pot</Badge>
          )}
        </div>
        {receipt ? (
          <button
            type="button"
            onClick={openReceipt}
            disabled={loading}
            className="text-xs underline mt-1"
          >
            {loading ? tCommon('loading') : 'View receipt'}
          </button>
        ) : null}
        {error ? <div className="text-y2k-magenta text-xs">{error}</div> : null}
      </div>
      <strong>{formatBaht(expense.amountCents)}</strong>
    </li>
  );
}

