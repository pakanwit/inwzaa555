import type { Attachment } from '@/lib/types'
import { attachments } from '@/lib/db/schema'

export function toAttachment(row: typeof attachments.$inferSelect): Attachment {
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
