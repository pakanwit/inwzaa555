import Link from 'next/link'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, expenses, contributions, attachments } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/server'
import { computeBalances } from '@/lib/balance'
import { formatBaht } from '@/lib/money'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { ExpenseRow, findFronter } from '@/components/features/expense-row'
import type { User, Expense, Contribution, Attachment } from '@/lib/types'

function toUser(row: typeof users.$inferSelect): User {
  return { id: row.id, email: row.email ?? undefined, displayName: row.displayName, avatarUrl: row.avatarUrl ?? undefined, role: row.role, removedAt: row.removedAt?.toISOString(), createdAt: row.createdAt.toISOString() }
}
function toAttachment(row: typeof attachments.$inferSelect): Attachment {
  return { id: row.id, parentType: row.parentType, parentId: row.parentId, storagePath: row.storagePath, mimeType: row.mimeType, uploadedBy: row.uploadedBy, uploadedAt: row.uploadedAt.toISOString() }
}
function toExpense(row: typeof expenses.$inferSelect, attachmentList: Attachment[] = []): Expense {
  return { id: row.id, amountCents: row.amountCents, description: row.description, category: row.category, occurredAt: row.occurredAt.toISOString(), frontedByUserId: row.frontedByUserId ?? undefined, reimbursedAt: row.reimbursedAt?.toISOString(), createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), attachments: attachmentList }
}
function toContribution(row: typeof contributions.$inferSelect, attachmentList: Attachment[] = []): Contribution {
  return { id: row.id, userId: row.userId, amountCents: row.amountCents, contributedAt: row.contributedAt.toISOString(), note: row.note ?? undefined, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), attachments: attachmentList }
}

export default async function DashboardPage() {
  const currentUser = await getUser()
  const [userRows, expenseRows, contributionRows] = await Promise.all([
    db.select().from(users),
    db.select().from(expenses).orderBy(desc(expenses.occurredAt)),
    db.select().from(contributions),
  ])

  const allUsers = userRows.map(toUser)

  const expenseIds = expenseRows.map((e) => e.id)
  const contributionIds = contributionRows.map((c) => c.id)
  const allParentIds = [...expenseIds, ...contributionIds]
  const attachmentRows = allParentIds.length
    ? await db
        .select()
        .from(attachments)
        .where(and(inArray(attachments.parentId, allParentIds)))
    : []
  const expenseAttachments = new Map<string, Attachment[]>()
  const contributionAttachments = new Map<string, Attachment[]>()
  for (const row of attachmentRows) {
    const target = row.parentType === 'expense' ? expenseAttachments : contributionAttachments
    const list = target.get(row.parentId) ?? []
    list.push(toAttachment(row))
    target.set(row.parentId, list)
  }

  const allExpenses = expenseRows.map((e) => toExpense(e, expenseAttachments.get(e.id) ?? []))
  const allContributions = contributionRows.map((c) => toContribution(c, contributionAttachments.get(c.id) ?? []))
  const b = computeBalances({ users: allUsers, contributions: allContributions, expenses: allExpenses })
  const recent = allExpenses.slice(0, 5)

  // Unsettled fronted amounts by user
  const owedMap = new Map<string, number>()
  for (const e of allExpenses) {
    if (e.frontedByUserId && !e.reimbursedAt) {
      owedMap.set(e.frontedByUserId, (owedMap.get(e.frontedByUserId) ?? 0) + e.amountCents)
    }
  }

  // Per-member contribution totals — for the "Who paid" window
  const contributedByUser = new Map<string, number>()
  for (const c of allContributions) {
    contributedByUser.set(c.userId, (contributedByUser.get(c.userId) ?? 0) + c.amountCents)
  }
  const paidRows = allUsers
    .filter((u) => !u.removedAt)
    .map((u) => ({ user: u, total: contributedByUser.get(u.id) ?? 0 }))
    .sort((a, b) => b.total - a.total || a.user.displayName.localeCompare(b.user.displayName))

  const isAdmin = currentUser.role === 'admin'

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Pot summary */}
      <Window title="The Kitty">
        <div className="grid grid-cols-2 gap-3 text-center">
          <Stat label="Pot total" value={formatBaht(b.potTotal)} />
          <Stat label="Remaining cash" value={formatBaht(b.potRemaining)} accent />
          <Stat label="Spent so far" value={formatBaht(b.potSpent)} />
          <Stat label="Fair share / person" value={formatBaht(b.fairShare)} />
        </div>
      </Window>

      {/* Who paid into the Pot */}
      <Window title="Who paid into the Pot">
        {paidRows.length === 0 ? (
          <p className="text-xs">No members yet.</p>
        ) : (
          <ul className="space-y-1">
            {paidRows.map(({ user, total }) => (
              <li key={user.id} className="flex justify-between">
                <span>{user.displayName}</span>
                <strong>{total > 0 ? formatBaht(total) : '—'}</strong>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-xs"><Link href="/contributions">View all contributions →</Link></div>
      </Window>

      {/* Pot owes */}
      <Window title="Pot owes…">
        {owedMap.size === 0 ? (
          <p>No outstanding reimbursements. ✔</p>
        ) : (
          <ul className="space-y-1">
            {[...owedMap.entries()].map(([uid, cents]) => {
              const u = allUsers.find((x) => x.id === uid)
              return (
                <li key={uid} className="flex justify-between">
                  <span>{u?.displayName ?? uid}</span>
                  <strong>{formatBaht(cents)}</strong>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-3 text-xs"><Link href="/expenses">View all expenses →</Link></div>
      </Window>

      {/* Recent expenses */}
      <div className="md:col-span-2 bevel-out bg-y2k-chrome-200 p-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">Recent expenses</h2>
          <div className="flex gap-2">
            <Link href="/expenses/new"><Button variant="primary">Add expense</Button></Link>
            {isAdmin ? (
              <Link href="/contributions/new"><Button>Add contribution</Button></Link>
            ) : null}
          </div>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs">No expenses yet.</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((e) => (
              <ExpenseRow key={e.id} expense={e} fronterName={findFronter(allUsers, e)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bevel-in bg-white p-3">
      <div className="text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-y2k-blue' : 'text-black'}`}>{value}</div>
    </div>
  )
}
