import { pgTable, pgSchema, uuid, text, timestamp, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Reference Supabase's managed auth schema for the FK constraint
const authSchema = pgSchema('auth')
const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('member'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('role_check', sql`${t.role} IN ('admin', 'member')`)],
)
