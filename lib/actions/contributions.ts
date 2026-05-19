'use server'
import { revalidatePath } from 'next/cache'
import { desc, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { contributions, users } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/server'
import { can } from '@/lib/permissions'
import { parseBahtInput } from '@/lib/money'
import type { Contribution, User } from '@/lib/types'

function toContribution(row: typeof contributions.$inferSelect): Contribution {
  return {
    id: row.id,
    userId: row.userId,
    amountCents: row.amountCents,
    contributedAt: row.contributedAt.toISOString(),
    note: row.note ?? undefined,
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

export async function listContributions(): Promise<{ contributions: Contribution[]; users: User[] }> {
  await getUser()
  const [contribRows, userRows] = await Promise.all([
    db.select().from(contributions).orderBy(desc(contributions.contributedAt)),
    db.select().from(users),
  ])
  return { contributions: contribRows.map(toContribution), users: userRows.map(toUser) }
}

export async function getActiveUsers(): Promise<User[]> {
  await getUser()
  const rows = await db.select().from(users).where(isNull(users.removedAt))
  return rows.map(toUser)
}

const createSchema = z.object({
  userId: z.string().uuid(),
  amountBaht: z.string().min(1),
  contributedAt: z.string().min(1),
  note: z.string().optional(),
})

export async function createContribution(
  values: z.infer<typeof createSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  const parsed = createSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid form data' }

  const amountCents = parseBahtInput(parsed.data.amountBaht)
  if (!amountCents || amountCents <= 0) return { ok: false, error: 'Invalid amount' }

  // Members can only create for themselves; admins can create for anyone
  const targetUserId = actor.role === 'admin' ? parsed.data.userId : actor.id
  const action = targetUserId === actor.id ? 'contribution.create.self' : 'contribution.create.other'
  if (!can(actor, action)) return { ok: false, error: 'Not permitted' }

  await db.insert(contributions).values({
    userId: targetUserId,
    amountCents,
    contributedAt: new Date(parsed.data.contributedAt),
    note: parsed.data.note || null,
    createdBy: actor.id,
  })

  revalidatePath('/contributions')
  revalidatePath('/')
  return { ok: true }
}
