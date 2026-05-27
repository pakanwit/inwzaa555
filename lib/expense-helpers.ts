import type { Expense, User } from '@/lib/types'

export function findFronter(users: User[], expense: Expense): string | undefined {
  if (!expense.frontedByUserId) return undefined
  return users.find((u) => u.id === expense.frontedByUserId)?.displayName
}
