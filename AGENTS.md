<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database migrations: drizzle-kit, not Supabase CLI

This repo uses **drizzle-orm** for runtime queries AND **drizzle-kit** for migrations. The TypeScript schema in `lib/db/schema.ts` is the single source of truth — both query types and migration SQL derive from it. Do not introduce `supabase/migrations/` or the Supabase CLI workflow alongside; pick one or the other.

## Commands (all in `package.json`)

| Need | Command |
|---|---|
| Generate migration after editing `lib/db/schema.ts` | `npm run db:generate` |
| Create an empty migration for raw SQL (triggers, RLS, Storage buckets, anything drizzle can't model) | `npm run db:generate:custom` |
| Apply pending migrations to the linked DB | `npm run db:migrate` |
| Push schema directly without versioned migrations (dev only) | `npm run db:push` |

All four wrap the CLI with `dotenv-cli -e .env.local` so `DATABASE_URL` is loaded automatically. Don't call `drizzle-kit` bare — it won't see your env.

## File conventions

- Migrations live in `drizzle/*.sql` with `meta/_journal.json` + per-migration snapshots.
- The historical `manual_*.sql` naming is retired. Use `npm run db:generate:custom` instead — it produces a tracked, journal-aware empty migration. See `drizzle/0003_receipts_bucket.sql` and `drizzle/0004_auth_user_trigger.sql` for examples (Storage bucket and a Postgres trigger respectively).
- Custom migrations must be idempotent where possible (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`) so re-running over a partially-applied DB is safe.

## Known quirks

- **Dashboard "Migrations" page is empty.** It reads `supabase_migrations.schema_migrations`, which only the Supabase CLI populates. drizzle-kit writes to `drizzle.__drizzle_migrations`. The DB is fully migrated; the Dashboard UI is just blind. Don't try to "fix" this by switching to Supabase CLI.
- **Storage tables can't be wiped with raw `DELETE`.** Supabase's `storage.protect_delete()` trigger blocks `DELETE FROM storage.objects` / `storage.buckets`. To clear storage state during a reset, use the Storage API or skip those rows entirely if the bucket doesn't exist yet.

## Reset workflow (when you need a clean DB)

1. Run a wipe SQL in **Supabase Dashboard → SQL Editor**: drop public tables with `CASCADE`, drop the `on_auth_user_created` trigger and `public.handle_new_auth_user()` function, and `DELETE FROM supabase_migrations.schema_migrations` to clear any stale CLI-era entries. (Leave `auth.users` so existing logins persist.)
2. `npm run db:migrate` — drizzle reapplies everything in order.
3. Sign in once to trigger `public.users` row creation, then promote yourself to admin via `UPDATE public.users SET role='admin' WHERE email='…'`.

Do not use `supabase db reset --linked` — this repo isn't set up for the Supabase CLI workflow and adding it duplicates the migration source.
