import { listContributions } from '@/lib/actions/contributions'
import { ContributionRow } from '@/components/features/contribution-row'
import { Button } from '@/components/y2k/button'
import { getUser } from '@/lib/auth/server'
import { formatBaht } from '@/lib/money'
import Link from 'next/link'

export default async function ContributionsPage() {
  const [{ contributions, users }, currentUser] = await Promise.all([
    listContributions(),
    getUser(),
  ])
  const isAdmin = currentUser.role === 'admin'
  const total = contributions.reduce((sum, c) => sum + c.amountCents, 0)
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">Contributions</h1>
          <p className="text-xs">
            {contributions.length} {contributions.length === 1 ? 'contribution' : 'contributions'}
            {contributions.length > 0 ? ` · ${formatBaht(total)} total` : ''}
          </p>
        </div>
        {isAdmin ? (
          <Link href="/contributions/new">
            <Button variant="primary">Add contribution</Button>
          </Link>
        ) : null}
      </div>
      <ul className="space-y-1">
        {contributions.length === 0 ? (
          <li className="text-xs">No contributions yet.</li>
        ) : (
          contributions.map((c) => (
            <ContributionRow
              key={c.id}
              contribution={c}
              user={users.find((u) => u.id === c.userId)}
              members={users}
              isAdmin={isAdmin}
            />
          ))
        )}
      </ul>
    </div>
  )
}
