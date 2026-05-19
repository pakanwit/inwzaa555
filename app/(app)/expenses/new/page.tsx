import { getUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isNull } from 'drizzle-orm'
import NewExpenseForm from './new-expense-form'
import type { User } from '@/lib/types'

export default async function NewExpensePage() {
  const currentUser = await getUser()
  const rows = await db.select().from(users).where(isNull(users.removedAt))
  const allUsers: User[] = rows.map((r) => ({
    id: r.id, email: r.email, displayName: r.displayName,
    avatarUrl: r.avatarUrl ?? undefined, role: r.role,
    removedAt: r.removedAt?.toISOString(), createdAt: r.createdAt.toISOString(),
  }))
  return <NewExpenseForm currentUser={currentUser} users={allUsers} />
}
