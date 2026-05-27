'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { expenses, users, attachments } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/server'
import { createSupabaseAdminClient } from '@/lib/auth/admin'
import { can } from '@/lib/permissions'
import { parseBahtInput } from '@/lib/money'
import {
  createExpenseInputSchema,
  type CreateExpenseInput,
} from '@/lib/expense-form'
import { isReceiptPathForExpense } from '@/lib/actions/expense-paths'
import type { Attachment, Expense, User } from '@/lib/types'

const RECEIPTS_BUCKET = 'receipts'
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

const uploadUrlSchema = z.object({
  expenseId: z.string().uuid(),
  mimeType: z.enum(ALLOWED_MIME),
  ext: z.enum(['jpg', 'jpeg', 'png', 'webp', 'heic']),
})

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
    email: row.email ?? undefined,
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

export async function createExpense(
  values: CreateExpenseInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  const parsed = createExpenseInputSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid form data' }

  const amountCents = parseBahtInput(parsed.data.amountBaht)
  if (!amountCents || amountCents <= 0) return { ok: false, error: 'Invalid amount' }

  const frontedByUserId = parsed.data.paidBy === 'pot' ? null : parsed.data.paidBy

  if (frontedByUserId === null && !can(actor, 'expense.create.fromPot'))
    return { ok: false, error: 'Only admins can log pot expenses' }
  if (frontedByUserId !== null && frontedByUserId !== actor.id && !can(actor, 'expense.create.frontedByOther'))
    return { ok: false, error: 'Only admins can log expenses for others' }

  // Client may supply an `id` so the receipt upload can target the correct
  // path before the expense row exists. If absent, generate one server-side.
  const expenseId = parsed.data.id ?? crypto.randomUUID()

  if (
    parsed.data.receiptStoragePath &&
    !isReceiptPathForExpense(parsed.data.receiptStoragePath, expenseId)
  ) {
    return { ok: false, error: 'Receipt path mismatch' }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        id: expenseId,
        amountCents,
        description: parsed.data.description,
        category: parsed.data.category,
        occurredAt: new Date(parsed.data.occurredAt),
        frontedByUserId,
        createdBy: actor.id,
      })
      if (parsed.data.receiptStoragePath && parsed.data.receiptMimeType) {
        await tx.insert(attachments).values({
          parentType: 'expense',
          parentId: expenseId,
          storagePath: parsed.data.receiptStoragePath,
          mimeType: parsed.data.receiptMimeType,
          uploadedBy: actor.id,
        })
      }
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save expense' }
  }

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

export async function getSignedReceiptUploadUrl(
  values: z.infer<typeof uploadUrlSchema>,
): Promise<
  | { ok: true; storagePath: string; token: string }
  | { ok: false; error: string }
> {
  const actor = await getUser()
  if (!can(actor, 'expense.create.frontedBySelf')) return { ok: false, error: 'Not permitted' }

  const parsed = uploadUrlSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid upload request' }

  const fileId = crypto.randomUUID()
  const storagePath = `expense/${parsed.data.expenseId}/${fileId}.${parsed.data.ext}`

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUploadUrl(storagePath)
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create upload URL' }

  return { ok: true, storagePath, token: data.token }
}

export async function getSignedReceiptDownloadUrl(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await getUser()
  if (!storagePath.startsWith('expense/')) return { ok: false, error: 'Invalid path' }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create download URL' }

  return { ok: true, url: data.signedUrl }
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
