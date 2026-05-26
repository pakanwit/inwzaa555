'use server'
import { revalidatePath } from 'next/cache'
import { eq, asc, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users, contributions, expenses, attachments } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/server'
import { createSupabaseAdminClient } from '@/lib/auth/admin'
import { can } from '@/lib/permissions'
import type { User } from '@/lib/types'

export type MemberWithStats = User & { referenceCount: number }

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id, email: row.email ?? undefined, displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? undefined, role: row.role,
    removedAt: row.removedAt?.toISOString(), createdAt: row.createdAt.toISOString(),
  }
}

const createMemberSchema = z.object({
  displayName: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
})

export async function createMember(
  values: z.infer<typeof createMemberSchema>,
): Promise<{ ok: true; member: User } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'member.promote')) return { ok: false, error: 'Not permitted' }
  const parsed = createMemberSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid member data' }
  const [row] = await db
    .insert(users)
    .values({
      displayName: parsed.data.displayName.trim(),
      email: parsed.data.email ?? null,
      role: 'member',
    })
    .returning()
  if (!row) return { ok: false, error: 'Failed to create member' }
  revalidatePath('/members')
  revalidatePath('/contributions')
  revalidatePath('/')
  return { ok: true, member: toUser(row) }
}

export async function listMembers(): Promise<MemberWithStats[]> {
  await getUser()
  const [memberRows, contribCounts, expenseCounts, attachmentCounts] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt)),
    db
      .select({ userId: users.id, count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(
        contributions,
        or(eq(contributions.userId, users.id), eq(contributions.createdBy, users.id)),
      )
      .where(sql`${contributions.id} is not null`)
      .groupBy(users.id),
    db
      .select({ userId: users.id, count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(
        expenses,
        or(eq(expenses.frontedByUserId, users.id), eq(expenses.createdBy, users.id)),
      )
      .where(sql`${expenses.id} is not null`)
      .groupBy(users.id),
    db
      .select({ userId: users.id, count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(attachments, eq(attachments.uploadedBy, users.id))
      .where(sql`${attachments.id} is not null`)
      .groupBy(users.id),
  ])

  const counts = new Map<string, number>()
  for (const r of [...contribCounts, ...expenseCounts, ...attachmentCounts]) {
    counts.set(r.userId, (counts.get(r.userId) ?? 0) + r.count)
  }
  return memberRows.map((row) => ({ ...toUser(row), referenceCount: counts.get(row.id) ?? 0 }))
}

export async function promoteToAdmin(targetId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'member.promote')) return { ok: false, error: 'Not permitted' }
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, targetId))
  revalidatePath('/members')
  return { ok: true }
}

export async function demoteToMember(targetId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'member.demote')) return { ok: false, error: 'Not permitted' }
  if (targetId === actor.id) return { ok: false, error: 'Cannot demote yourself' }
  await db.update(users).set({ role: 'member' }).where(eq(users.id, targetId))
  revalidatePath('/members')
  return { ok: true }
}

export async function removeMember(targetId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'member.remove')) return { ok: false, error: 'Not permitted' }
  if (targetId === actor.id) return { ok: false, error: 'Cannot remove yourself' }
  // Set removed_at first (immediate lockout), then revoke Supabase session best-effort
  await db.update(users).set({ removedAt: new Date() }).where(eq(users.id, targetId))
  try {
    const admin = createSupabaseAdminClient()
    await admin.auth.admin.deleteUser(targetId)
  } catch {
    // Best-effort — user is already locked out by removed_at check
  }
  revalidatePath('/members')
  return { ok: true }
}

const updateMemberSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(['admin', 'member']),
})

export async function updateMember(
  values: z.infer<typeof updateMemberSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'member.update')) return { ok: false, error: 'Not permitted' }
  const parsed = updateMemberSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid member data' }
  // Self-guard: can't change own role (matches existing demote-self block).
  if (parsed.data.id === actor.id && parsed.data.role !== actor.role) {
    return { ok: false, error: 'Cannot change your own role' }
  }
  await db
    .update(users)
    .set({
      displayName: parsed.data.displayName.trim(),
      email: parsed.data.email ?? null,
      role: parsed.data.role,
    })
    .where(eq(users.id, parsed.data.id))
  revalidatePath('/members')
  revalidatePath('/contributions')
  revalidatePath('/')
  return { ok: true }
}

export async function hardDeleteMember(targetId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'member.delete.hard')) return { ok: false, error: 'Not permitted' }
  if (targetId === actor.id) return { ok: false, error: 'Cannot delete yourself' }

  // Server-side re-check of reference count — UI hides the button, but defense in depth.
  const [contribRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contributions)
    .where(or(eq(contributions.userId, targetId), eq(contributions.createdBy, targetId)))
  const [expenseRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expenses)
    .where(or(eq(expenses.frontedByUserId, targetId), eq(expenses.createdBy, targetId)))
  const [attachmentRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attachments)
    .where(eq(attachments.uploadedBy, targetId))

  const total = (contribRow?.count ?? 0) + (expenseRow?.count ?? 0) + (attachmentRow?.count ?? 0)
  if (total > 0) {
    return { ok: false, error: 'Member has history; use Remove (soft delete) instead' }
  }

  // Delete the auth.users row too (best-effort) so the Member can't sign back in
  // and re-create themselves via the trigger.
  try {
    const admin = createSupabaseAdminClient()
    await admin.auth.admin.deleteUser(targetId)
  } catch {
    // Best-effort — the public.users row is the source of truth
  }
  await db.delete(users).where(eq(users.id, targetId))
  revalidatePath('/members')
  revalidatePath('/contributions')
  revalidatePath('/')
  return { ok: true }
}

export async function generateMagicLink(targetId: string): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'invite.create')) return { ok: false, error: 'Not permitted' }
  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1)
  if (!target) return { ok: false, error: 'User not found' }
  if (!target.email) return { ok: false, error: 'Member has no email; add one before generating a magic link' }
  if (!process.env.SUPABASE_SECRET_KEY) return { ok: false, error: 'Magic link generation requires SUPABASE_SECRET_KEY to be configured' }
  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: target.email })
    if (error || !data.properties?.action_link) return { ok: false, error: 'Failed to generate link' }
    return { ok: true, link: data.properties.action_link }
  } catch {
    return { ok: false, error: 'Failed to generate link' }
  }
}
