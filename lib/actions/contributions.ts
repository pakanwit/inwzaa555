'use server'
import { revalidatePath } from 'next/cache'
import { desc, isNull, eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { contributions, users, attachments } from '@/lib/db/schema'
import { getUser } from '@/lib/auth/server'
import { createSupabaseAdminClient } from '@/lib/auth/admin'
import { can } from '@/lib/permissions'
import { parseBahtInput } from '@/lib/money'
import type { Attachment, Contribution, User } from '@/lib/types'

const RECEIPTS_BUCKET = 'receipts'
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const
type AllowedMime = (typeof ALLOWED_MIME)[number]

function toContribution(
  row: typeof contributions.$inferSelect,
  rowAttachments: Attachment[] = [],
): Contribution {
  return {
    id: row.id,
    userId: row.userId,
    amountCents: row.amountCents,
    contributedAt: row.contributedAt.toISOString(),
    note: row.note ?? undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    attachments: rowAttachments,
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

function toAttachment(row: typeof attachments.$inferSelect): Attachment {
  return {
    id: row.id,
    parentType: row.parentType,
    parentId: row.parentId,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt.toISOString(),
  }
}

export async function listContributions(): Promise<{ contributions: Contribution[]; users: User[] }> {
  await getUser()
  const [contribRows, userRows] = await Promise.all([
    db.select().from(contributions).orderBy(desc(contributions.contributedAt)),
    db.select().from(users),
  ])

  const contributionIds = contribRows.map((c) => c.id)
  const attachmentRows = contributionIds.length
    ? await db
        .select()
        .from(attachments)
        .where(
          and(eq(attachments.parentType, 'contribution'), inArray(attachments.parentId, contributionIds)),
        )
    : []

  const byParent = new Map<string, Attachment[]>()
  for (const row of attachmentRows) {
    const list = byParent.get(row.parentId) ?? []
    list.push(toAttachment(row))
    byParent.set(row.parentId, list)
  }

  return {
    contributions: contribRows.map((c) => toContribution(c, byParent.get(c.id) ?? [])),
    users: userRows.map(toUser),
  }
}

export async function getActiveUsers(): Promise<User[]> {
  await getUser()
  const rows = await db.select().from(users).where(isNull(users.removedAt))
  return rows.map(toUser)
}

const uploadUrlSchema = z.object({
  contributionId: z.string().uuid(),
  mimeType: z.enum(ALLOWED_MIME),
  ext: z.enum(['jpg', 'jpeg', 'png', 'webp', 'heic']),
})

export async function getSignedSlipUploadUrl(
  values: z.infer<typeof uploadUrlSchema>,
): Promise<
  | { ok: true; storagePath: string; token: string }
  | { ok: false; error: string }
> {
  const actor = await getUser()
  if (!can(actor, 'contribution.create.other')) return { ok: false, error: 'Not permitted' }

  const parsed = uploadUrlSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid upload request' }

  const fileId = crypto.randomUUID()
  const storagePath = `contribution/${parsed.data.contributionId}/${fileId}.${parsed.data.ext}`

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUploadUrl(storagePath)
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create upload URL' }

  return { ok: true, storagePath, token: data.token }
}

export async function getSignedSlipDownloadUrl(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await getUser()
  if (!storagePath.startsWith('contribution/')) return { ok: false, error: 'Invalid path' }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create download URL' }

  return { ok: true, url: data.signedUrl }
}

const createSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amountBaht: z.string().min(1),
  contributedAt: z.string().min(1),
  note: z.string().optional(),
  slipStoragePath: z.string().min(1),
  slipMimeType: z.enum(ALLOWED_MIME),
})

export async function createContribution(
  values: z.infer<typeof createSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  const parsed = createSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid form data' }

  const amountCents = parseBahtInput(parsed.data.amountBaht)
  if (!amountCents || amountCents <= 0) return { ok: false, error: 'Invalid amount' }

  if (!can(actor, 'contribution.create.other')) return { ok: false, error: 'Not permitted' }

  // Storage path must belong to the contribution we're inserting — prevents a
  // forged path that points at someone else's slip.
  const expectedPrefix = `contribution/${parsed.data.id}/`
  if (!parsed.data.slipStoragePath.startsWith(expectedPrefix)) {
    return { ok: false, error: 'Slip path mismatch' }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(contributions).values({
        id: parsed.data.id,
        userId: parsed.data.userId,
        amountCents,
        contributedAt: new Date(parsed.data.contributedAt),
        note: parsed.data.note || null,
        createdBy: actor.id,
      })
      await tx.insert(attachments).values({
        parentType: 'contribution',
        parentId: parsed.data.id,
        storagePath: parsed.data.slipStoragePath,
        mimeType: parsed.data.slipMimeType as AllowedMime,
        uploadedBy: actor.id,
      })
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save contribution' }
  }

  revalidatePath('/contributions')
  revalidatePath('/')
  return { ok: true }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amountBaht: z.string().min(1),
  contributedAt: z.string().min(1),
  note: z.string().optional(),
})

export async function updateContribution(
  values: z.infer<typeof updateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'contribution.update', { resource: {} as Contribution })) {
    return { ok: false, error: 'Not permitted' }
  }
  const parsed = updateSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: 'Invalid form data' }

  const amountCents = parseBahtInput(parsed.data.amountBaht)
  if (!amountCents || amountCents <= 0) return { ok: false, error: 'Invalid amount' }

  await db
    .update(contributions)
    .set({
      userId: parsed.data.userId,
      amountCents,
      contributedAt: new Date(parsed.data.contributedAt),
      note: parsed.data.note || null,
    })
    .where(eq(contributions.id, parsed.data.id))

  revalidatePath('/contributions')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteContribution(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUser()
  if (!can(actor, 'contribution.delete', { resource: {} as Contribution })) {
    return { ok: false, error: 'Not permitted' }
  }

  // Best-effort: remove slip files from Storage. The DB delete is the source
  // of truth — leftover files would just be orphans, recoverable later.
  const slipRows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.parentType, 'contribution'), eq(attachments.parentId, id)))
  if (slipRows.length > 0) {
    try {
      const supabase = createSupabaseAdminClient()
      await supabase.storage.from(RECEIPTS_BUCKET).remove(slipRows.map((r) => r.storagePath))
    } catch {
      // ignored — orphan files are acceptable
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(attachments)
      .where(and(eq(attachments.parentType, 'contribution'), eq(attachments.parentId, id)))
    await tx.delete(contributions).where(eq(contributions.id, id))
  })

  revalidatePath('/contributions')
  revalidatePath('/')
  return { ok: true }
}
