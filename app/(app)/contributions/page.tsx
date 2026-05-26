import { listContributions } from '@/lib/actions/contributions'
import { ContributionRow } from '@/components/features/contribution-row'
import { Button } from '@/components/y2k/button'
import { getUser } from '@/lib/auth/server'
import Link from 'next/link'

export default async function ContributionsPage() {
  const [{ contributions, users }, currentUser] = await Promise.all([
    listContributions(),
    getUser(),
  ])
  const isAdmin = currentUser.role === 'admin'
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">Contributions</h1>
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
            />
          ))
        )}
      </ul>
    </div>
  )
}
