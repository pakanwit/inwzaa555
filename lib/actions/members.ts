'use server'
import { revalidatePath } from 'next/cache'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/server'
import { createSupabaseAdminClient } from '@/lib/auth/admin'
import { can } from '@/lib/permissions'
import type { User } from '@/lib/types'

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id, email: row.email, displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? undefined, role: row.role,
    removedAt: row.removedAt?.toISOString(), createdAt: row.createdAt.toISOString(),
  }
}

export async function listMembers(): Promise<User[]> {
  await getUser()
  const rows = await db.select().from(users).orderBy(asc(users.createdAt))
  return rows.map(toUser)
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

export async function generateMagicLink(targetId: string): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'invite.create')) return { ok: false, error: 'Not permitted' }
  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1)
  if (!target) return { ok: false, error: 'User not found' }
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
