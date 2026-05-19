'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expenses, users } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/server'
import { can } from '@/lib/permissions'
import { parseBahtInput } from '@/lib/money'
import { expenseFormSchema, type ExpenseFormValues } from '@/lib/expense-form'
import type { Expense, User } from '@/lib/types'

function toExpense(row: typeof expenses.$inferSelect): Expense {
  return {
    id: row.id,
    amountCents: row.amountCents,
    description: row.description,
    category: row.category,
    occurredAt: row.occurredAt.toISOString(),
    frontedByUserId: row.frontedByUserId ?? undefined,
    reimbursedAt: row.reimbursedAt?.toISOString(),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    attachments: [],
  }
}

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? undefined,
    role: row.role,
    removedAt: row.removedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listExpenses(): Promise<{ expenses: Expense[]; users: User[] }> {
  await getUser()
  const [expenseRows, userRows] = await Promise.all([
    db.select().from(expenses).orderBy(desc(expenses.occurredAt)),
    db.select().from(users),
  ])
  return { expenses: expenseRows.map(toExpense), users: userRows.map(toUser) }
}

export async function getExpenseById(id: string): Promise<{ expense: Expense; users: User[] } | null> {
  await getUser()
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1)
  if (!row) return null
  const userRows = await db.select().from(users)
  return { expense: toExpense(row), users: userRows.map(toUser) }
}

export async function createExpense(values: ExpenseFormValues): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  const parsed = expenseFormSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid form data' }

  const amountCents = parseBahtInput(parsed.data.amountBaht)
  if (!amountCents || amountCents <= 0) return { ok: false, error: 'Invalid amount' }

  const frontedByUserId = parsed.data.paidBy === 'pot' ? null : parsed.data.paidBy

  // Permission check
  if (frontedByUserId === null && !can(actor, 'expense.create.fromPot'))
    return { ok: false, error: 'Only admins can log pot expenses' }
  if (frontedByUserId !== null && frontedByUserId !== actor.id && !can(actor, 'expense.create.frontedByOther'))
    return { ok: false, error: 'Only admins can log expenses for others' }

  await db.insert(expenses).values({
    amountCents,
    description: parsed.data.description,
    category: parsed.data.category,
    occurredAt: new Date(parsed.data.occurredAt),
    frontedByUserId,
    createdBy: actor.id,
  })

  revalidatePath('/expenses')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1)
  if (!row) return { ok: false, error: 'Expense not found' }
  const expense = toExpense(row)
  if (!can(actor, 'expense.delete', { resource: expense }))
    return { ok: false, error: 'Not permitted' }
  await db.delete(expenses).where(eq(expenses.id, id))
  revalidatePath('/expenses')
  revalidatePath('/')
  redirect('/expenses')
}

export async function markExpenseReimbursed(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1)
  if (!row) return { ok: false, error: 'Expense not found' }
  const expense = toExpense(row)
  if (!can(actor, 'expense.markReimbursed', { resource: expense }))
    return { ok: false, error: 'Not permitted' }
  await db.update(expenses).set({ reimbursedAt: new Date() }).where(eq(expenses.id, id))
  revalidatePath(`/expenses/${id}`)
  revalidatePath('/')
  return { ok: true }
}
