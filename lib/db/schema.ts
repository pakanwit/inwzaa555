import { pgTable, uuid, text, timestamp, bigint, check, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { ExpenseCategory } from '@/lib/types'

// A users row may be created by Admin without any auth.users link (an
// unclaimed Member), so we no longer FK id to auth.users. The trigger on
// auth.users still inserts rows with id=auth.users.id by convention, but
// that's not enforced at the DB level.
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('member').$type<'admin' | 'member'>(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('role_check', sql`${t.role} IN ('admin', 'member')`)],
)

export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    contributedAt: timestamp('contributed_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('contributions_amount_positive', sql`${t.amountCents} > 0`),
    index('contributions_user_id_idx').on(t.userId),
  ],
)

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentType: text('parent_type').notNull().$type<'contribution' | 'expense'>(),
    parentId: uuid('parent_id').notNull(),
    storagePath: text('storage_path').notNull(),
    mimeType: text('mime_type').notNull(),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('attachments_parent_type_check', sql`${t.parentType} IN ('contribution', 'expense')`),
    index('attachments_parent_idx').on(t.parentType, t.parentId),
  ],
)

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    description: text('description').notNull(),
    category: text('category').notNull().$type<ExpenseCategory>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    frontedByUserId: uuid('fronted_by_user_id').references(() => users.id),
    reimbursedAt: timestamp('reimbursed_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('expenses_amount_positive', sql`${t.amountCents} > 0`),
    check('expenses_category_check', sql`${t.category} IN ('food', 'transport', 'lodging', 'activity', 'other')`),
    index('expenses_occurred_at_idx').on(t.occurredAt),
    index('expenses_fronted_unsettled_idx').on(t.frontedByUserId).where(sql`${t.reimbursedAt} IS NULL`),
  ],
)
