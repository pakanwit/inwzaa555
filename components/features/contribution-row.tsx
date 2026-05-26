'use client'
import { useState } from 'react'
import { formatBaht } from '@/lib/money'
import { getSignedSlipDownloadUrl } from '@/lib/actions/contributions'
import type { Contribution, User } from '@/lib/types'

export function ContributionRow({
  contribution,
  user,
}: {
  contribution: Contribution
  user?: User
}) {
  const slip = contribution.attachments[0]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openSlip() {
    if (!slip) return
    setError(null)
    setLoading(true)
    const result = await getSignedSlipDownloadUrl(slip.storagePath)
    setLoading(false)
    if (!result.ok) { setError(result.error); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <li className="bevel-in bg-white p-2 flex items-center justify-between gap-2">
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
      <strong>{formatBaht(contribution.amountCents)}</strong>
    </li>
  )
}
