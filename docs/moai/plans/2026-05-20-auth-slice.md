# Auth Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or build to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Zustand mock auth layer with real Supabase Auth — users sign in via magic link, sessions persist in cookies, server actions read a real `users` DB row with role and `removed_at`.

**Architecture:** Next.js 16 App Router server components + `@supabase/ssr` for cookie-based sessions. `proxy.ts` (Next.js 16's renamed middleware) refreshes the Supabase access token on every request. `lib/auth/server.ts` provides `getUser()` for server components and server actions. `lib/auth/client.ts` provides `useCurrentUser()` for client components still backed by mock data. Drizzle manages the `users` table schema. All mutations use the Supabase Admin client (service role) so they bypass RLS. The mock Zustand store continues to back the expenses/contributions/members data — those pages will receive a real user object but show mock data. That mismatch is intentional and will be resolved in subsequent slices.

**Tech Stack:** `@supabase/ssr`, `@supabase/supabase-js`, `drizzle-orm`, `drizzle-kit`, `postgres` (node-postgres driver for Drizzle), Next.js 16 App Router, TypeScript strict.

**Key Next.js 16 note:** Middleware is renamed to **Proxy** in Next.js 16. The file is `proxy.ts` at the project root, not `middleware.ts`. The exported function is named `proxy` (or default export). See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

**Reference:** `docs/superpowers/specs/2026-05-19-trip-expense-tracker-design.md`, `docs/adr/0004-no-admin-emails-env-var.md`, `CONTEXT.md`

---

## File Structure

```
/
├── proxy.ts                          # NEW — session refresh (Next.js 16 Proxy)
├── drizzle.config.ts                 # NEW — Drizzle-Kit config
├── drizzle/                          # NEW — generated SQL migrations
│   └── 0000_users_table.sql
├── lib/
│   ├── types.ts                      # EXISTING — canonical domain types (already moved from mock)
│   ├── db/
│   │   ├── schema.ts                 # NEW — users table (Drizzle schema, auth slice only)
│   │   └── index.ts                  # NEW — Drizzle client (postgres.js)
│   └── auth/
│       ├── server.ts                 # NEW — getUser(), createSupabaseServerClient()
│       ├── client.ts                 # NEW — useCurrentUser(), createSupabaseBrowserClient()
│       └── admin.ts                  # NEW — createSupabaseAdminClient() (service role)
├── app/
│   ├── auth/callback/route.ts        # NEW — magic link callback handler
│   ├── providers.tsx                 # MODIFY — remove MockAuthProvider, become passthrough
│   ├── (app)/
│   │   ├── layout.tsx                # MODIFY — convert to server component, call getUser()
│   │   ├── expenses/
│   │   │   ├── new/page.tsx          # MODIFY — useAuth() → useCurrentUser()
│   │   │   └── [id]/page.tsx         # MODIFY — useAuth() → useCurrentUser()
│   │   ├── contributions/
│   │   │   └── new/page.tsx          # MODIFY — useAuth() → useCurrentUser()
│   │   └── members/page.tsx          # MODIFY — useAuth() → useCurrentUser()
│   └── (auth)/
│       ├── login/page.tsx            # MODIFY — replace mock form with real magic-link request
│       └── invite/[token]/page.tsx   # DELETE — no longer needed (admin provisions users)
└── components/
    ├── app-shell.tsx                 # MODIFY — accept currentUser prop, remove RoleSwitcher
    └── features/
        └── role-switcher.tsx         # DELETE
```

---

## Task 1: Install packages and set up `.env.local`

**Files:**
- Modify: `package.json`
- Create: `.env.local` (gitignored)

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js drizzle-orm postgres
```

Expected output: packages added to `package.json` with no errors.

- [ ] **Step 2: Install dev dependency**

```bash
npm install -D drizzle-kit
```

- [ ] **Step 3: Create `.env.local`**

Create `/Users/appleclub/Documents/personal/inwzaa555/.env.local` with the following content. Find values in the Supabase Dashboard → Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://spcppkmqhvjcwhayeldt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon/public key here>
SUPABASE_SERVICE_ROLE_KEY=<paste service role key here>
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

> **Note on DATABASE_URL:** Use the "Session mode" pooler URL (port 5432, not 6543) from Supabase Dashboard → Project Settings → Database → Connection string → Nodejs. The session pooler is safe for Vercel serverless at this scale (~10 users).

- [ ] **Step 4: Verify `.env.local` is gitignored**

```bash
grep "\.env\.local" /Users/appleclub/Documents/personal/inwzaa555/.gitignore
```

Expected: `.env.local` appears in output. If not, add it.

- [ ] **Step 5: Commit**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && git add package.json package-lock.json && git commit -m "chore(auth): install @supabase/ssr, drizzle-orm, drizzle-kit, postgres"
```

---

## Task 2: Drizzle config + `users` schema + DB client

**Files:**
- Create: `drizzle.config.ts`
- Create: `lib/db/schema.ts`
- Create: `lib/db/index.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 2: Create `lib/db/schema.ts`**

```ts
// lib/db/schema.ts
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
```

- [ ] **Step 3: Create `lib/db/index.ts`**

```ts
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// `prepare: false` required when using Supabase's connection pooler
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new files. (Ignore any pre-existing errors in mock-backed pages — those will be fixed in Task 8.)

- [ ] **Step 5: Commit**

```bash
git add drizzle.config.ts lib/db/schema.ts lib/db/index.ts && git commit -m "feat(db): drizzle config, users schema, postgres client"
```

---

## Task 3: Generate migration, add FK + RLS, apply via Supabase MCP

**Files:**
- Create: `drizzle/0000_users_table.sql` (generated then edited)

- [ ] **Step 1: Generate migration SQL**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && DATABASE_URL="$(grep DATABASE_URL .env.local | cut -d= -f2-)" npx drizzle-kit generate --name users_table
```

Expected: `drizzle/0000_users_table.sql` is created.

- [ ] **Step 2: Inspect the generated file**

```bash
cat /Users/appleclub/Documents/personal/inwzaa555/drizzle/0000_users_table.sql
```

Verify it includes: `CREATE TABLE "users"`, the FK `REFERENCES "auth"."users"("id") ON DELETE CASCADE`, and the check constraint.

- [ ] **Step 3: Append RLS policies to the migration file**

Open `drizzle/0000_users_table.sql` and append these lines at the end:

```sql
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Authenticated users can read their own row (needed for useCurrentUser() hook via anon key)
CREATE POLICY "users_read_own" ON "users"
  FOR SELECT TO authenticated
  USING (auth.uid() = id);
```

- [ ] **Step 4: Apply migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool to apply `drizzle/0000_users_table.sql` to project `spcppkmqhvjcwhayeldt`. The migration name should be `0000_users_table`.

- [ ] **Step 5: Verify the table exists**

Use the Supabase MCP `execute_sql` tool to run:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
```

Expected: 7 rows — `id`, `email`, `display_name`, `avatar_url`, `role`, `removed_at`, `created_at`.

- [ ] **Step 6: Commit**

```bash
git add drizzle/ && git commit -m "feat(db): users table migration with RLS"
```

---

## Task 4: Auth helpers — server, admin, client

**Files:**
- Create: `lib/auth/server.ts`
- Create: `lib/auth/admin.ts`
- Create: `lib/auth/client.ts`

- [ ] **Step 1: Create `lib/auth/server.ts`**

```ts
// lib/auth/server.ts
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import type { User } from '@/lib/types'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Ignored when called from a Server Component (read-only cookies context)
          }
        },
      },
    },
  )
}

/**
 * Returns the current user from the DB. Redirects to /login if:
 * - no active Supabase session
 * - no users row (not provisioned yet)
 * - user is soft-removed
 */
export async function getUser(): Promise<User> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1)

  if (!row || row.removedAt !== null) redirect('/login')

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? undefined,
    role: row.role as 'admin' | 'member',
    removedAt: row.removedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}
```

- [ ] **Step 2: Create `lib/auth/admin.ts`**

```ts
// lib/auth/admin.ts
import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS.
 * Server-only — never import in client components.
 * Used for: generating magic links, deleting users, inserting users rows.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
```

- [ ] **Step 3: Create `lib/auth/client.ts`**

```ts
// lib/auth/client.ts
'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import type { User } from '@/lib/types'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Returns the current user by querying the users table via the anon key.
 * Returns null while loading or when signed out.
 * The users table RLS policy "users_read_own" allows reading the own row.
 */
export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) { setUser(null); return }

      const { data: row } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!row || row.removed_at) { setUser(null); return }

      setUser({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url ?? undefined,
        role: row.role as 'admin' | 'member',
        removedAt: row.removed_at ?? undefined,
        createdAt: row.created_at,
      })
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => loadUser())

    return () => subscription.unsubscribe()
  }, [])

  return user
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npx tsc --noEmit 2>&1 | grep "lib/auth" | head -20
```

Expected: no errors in `lib/auth/`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/ && git commit -m "feat(auth): server, admin, and client Supabase helpers"
```

---

## Task 5: `proxy.ts` — session refresh on every request

**Files:**
- Create: `proxy.ts` (project root)

> **Next.js 16 note:** This file is `proxy.ts`, not `middleware.ts`. The function must be named `proxy` or be the default export. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

- [ ] **Step 1: Create `proxy.ts`**

```ts
// proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session — do not add any logic between createServerClient and getUser()
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verify Next.js starts without errors**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npm run dev 2>&1 | head -20
```

Expected: `▲ Next.js 16.x.x` starts, no proxy-related errors.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts && git commit -m "feat(auth): proxy.ts session refresh for @supabase/ssr"
```

---

## Task 6: `/auth/callback` route handler

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create `app/auth/callback/route.ts`**

```ts
// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser?.email) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  // Derive display_name from user_metadata; fall back to email prefix
  const displayName =
    (authUser.user_metadata?.display_name as string | undefined)?.trim() ||
    authUser.email.split('@')[0] ||
    'Member'

  // Insert users row on first sign-in; DO NOTHING on subsequent sign-ins
  await db
    .insert(users)
    .values({
      id: authUser.id,
      email: authUser.email,
      displayName,
      role: 'member',
    })
    .onConflictDoNothing()

  return NextResponse.redirect(new URL('/', origin))
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npx tsc --noEmit 2>&1 | grep "auth/callback" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/auth/callback/ && git commit -m "feat(auth): /auth/callback route — exchange code, upsert users row"
```

---

## Task 7: Convert `(app)/layout.tsx` to server component + update `AppShell`

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `components/app-shell.tsx`
- Modify: `app/providers.tsx`

- [ ] **Step 1: Replace `app/(app)/layout.tsx`**

The layout becomes a server component. `getUser()` handles the auth guard (it redirects to `/login` if there's no session). Pass the user to `AppShell` as a prop.

```tsx
// app/(app)/layout.tsx
import { AppShell } from '@/components/app-shell'
import { getUser } from '@/lib/auth/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  return <AppShell currentUser={user}>{children}</AppShell>
}
```

- [ ] **Step 2: Update `components/app-shell.tsx`**

Remove `useAuth()`. Receive `currentUser` as a prop. Remove `RoleSwitcher`.

```tsx
// components/app-shell.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { StatusBar } from '@/components/y2k/status-bar'
import type { User } from '@/lib/types'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/contributions', label: 'Pot' },
  { href: '/members', label: 'Members' },
]

export function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode
  currentUser: User
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex flex-col">
      <nav
        className="bevel-out bg-y2k-chrome-200 px-2 py-1 flex flex-wrap gap-1 items-center"
        aria-label="Primary"
      >
        <strong className="mr-2">inwzaa555</strong>
        {NAV.map((n) => {
          const active = pathname === n.href
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'bevel-out bg-y2k-chrome-100 px-2 py-0.5 no-underline text-black',
                active && 'font-bold bevel-in',
              )}
            >
              {n.label}
            </Link>
          )
        })}
        <span className="ml-auto text-xs">
          Signed in: {currentUser.displayName}
        </span>
      </nav>
      <main className="flex-1 p-3 md:p-6 max-w-3xl w-full mx-auto">{children}</main>
      <StatusBar className="m-2">
        Hello {currentUser.displayName} ({currentUser.role})
      </StatusBar>
    </div>
  )
}
```

- [ ] **Step 3: Simplify `app/providers.tsx`**

`MockAuthProvider` is removed. `Providers` becomes a passthrough (root layout still uses it; keeping it avoids touching `app/layout.tsx`).

```tsx
// app/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in the 4 pages that still use `useAuth()` — those are fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/layout.tsx components/app-shell.tsx app/providers.tsx && git commit -m "feat(auth): layout → server component, AppShell receives user as prop"
```

---

## Task 8: Swap `useAuth()` → `useCurrentUser()` in mock-backed pages

**Files:**
- Modify: `app/(app)/expenses/new/page.tsx`
- Modify: `app/(app)/expenses/[id]/page.tsx`
- Modify: `app/(app)/contributions/new/page.tsx`
- Modify: `app/(app)/members/page.tsx`

These pages still read from the Zustand mock store for their data — that's intentional (contributions slice comes next). We only replace the auth source.

- [ ] **Step 1: Update `app/(app)/expenses/new/page.tsx`**

Find the import and usage of `useAuth`:

```tsx
// REMOVE these two lines:
import { useAuth } from '@/lib/mock/auth-context';
// ...
const { currentUser } = useAuth();

// REPLACE WITH:
import { useCurrentUser } from '@/lib/auth/client';
// ...
const currentUser = useCurrentUser();
```

The rest of the component is unchanged. `currentUser` type is now `User | null` from `lib/types.ts`, which is the same shape the component already handles.

- [ ] **Step 2: Update `app/(app)/expenses/[id]/page.tsx`**

Same substitution:

```tsx
// REMOVE:
import { useAuth } from '@/lib/mock/auth-context';
const { currentUser } = useAuth();

// ADD:
import { useCurrentUser } from '@/lib/auth/client';
const currentUser = useCurrentUser();
```

- [ ] **Step 3: Update `app/(app)/contributions/new/page.tsx`**

```tsx
// REMOVE:
import { useAuth } from '@/lib/mock/auth-context';
const { currentUser } = useAuth();

// ADD:
import { useCurrentUser } from '@/lib/auth/client';
const currentUser = useCurrentUser();
```

- [ ] **Step 4: Update `app/(app)/members/page.tsx`**

```tsx
// REMOVE:
import { useAuth } from '@/lib/mock/auth-context';
const { currentUser } = useAuth();

// ADD:
import { useCurrentUser } from '@/lib/auth/client';
const currentUser = useCurrentUser();
```

- [ ] **Step 5: Verify TypeScript is clean**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (or only pre-existing unrelated errors).

- [ ] **Step 6: Run tests to confirm pure-logic modules are unaffected**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npm test
```

Expected: 41 tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/ && git commit -m "feat(auth): swap useAuth → useCurrentUser in mock-backed pages"
```

---

## Task 9: Rewrite login page + delete obsolete mock files

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Delete: `app/(auth)/invite/[token]/page.tsx`
- Delete: `components/features/role-switcher.tsx`

- [ ] **Step 1: Replace `app/(auth)/login/page.tsx`**

The real login page lets a user request a new magic link if theirs expired. It calls `signInWithOtp` with `shouldCreateUser: false` — so only pre-existing Supabase Auth users can get a link (no new sign-ups).

```tsx
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Marquee } from '@/components/y2k/marquee'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const supabase = createSupabaseBrowserClient()
    // shouldCreateUser: false — only works for existing auth.users rows
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    // Always show the same message — don't reveal whether the email is registered
    setSent(true)
    setBusy(false)
  }

  return (
    <main className="p-6 max-w-md mx-auto mt-8">
      <Marquee>Welcome to inwzaa555 2026!!! Best viewed in Internet Explorer 6.</Marquee>
      <div className="h-3" />
      <Window title="Sign in to inwzaa555">
        {sent ? (
          <p>If your email is registered, a magic link is on its way. Check your inbox.</p>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-3">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </Button>
          </form>
        )}
        <p className="mt-4 text-xs">
          Not registered? Ask an admin for an invite.
        </p>
      </Window>
    </main>
  )
}
```

- [ ] **Step 2: Delete `app/(auth)/invite/[token]/page.tsx`**

```bash
rm /Users/appleclub/Documents/personal/inwzaa555/app/\(auth\)/invite/\[token\]/page.tsx
rmdir /Users/appleclub/Documents/personal/inwzaa555/app/\(auth\)/invite/\[token\] 2>/dev/null || true
rmdir /Users/appleclub/Documents/personal/inwzaa555/app/\(auth\)/invite 2>/dev/null || true
```

- [ ] **Step 3: Delete `components/features/role-switcher.tsx`**

```bash
rm /Users/appleclub/Documents/personal/inwzaa555/components/features/role-switcher.tsx
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npm test
```

Expected: 41 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(auth): real login page, delete invite flow and role-switcher"
```

---

## Task 10: Smoke test the auth flow

No code changes — this task verifies the end-to-end flow works.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/appleclub/Documents/personal/inwzaa555 && npm run dev
```

- [ ] **Step 2: Verify unauthenticated redirect**

Open `http://localhost:3000` in a browser with no session. Expected: redirected to `/login`.

- [ ] **Step 3: Create a test user in Supabase Dashboard**

Go to Supabase Dashboard → Authentication → Users → Add user. Enter your email. Set `user_metadata` to `{"display_name": "Test Admin"}`.

- [ ] **Step 4: Bootstrap the first admin**

After step 3, go to Supabase Dashboard → Table Editor → `users` table. Find the row for your user. Change `role` from `member` to `admin`. Save.

> **If the users row doesn't exist yet:** The row is created on first sign-in (via `/auth/callback`). Complete step 5 first, then come back and set `role = 'admin'`.

- [ ] **Step 5: Test the magic link flow**

Visit `http://localhost:3000/login`. Enter your email. Click "Send magic link". Check your inbox, click the link. Expected: land on `http://localhost:3000` (dashboard) with your display name shown in the nav and status bar.

- [ ] **Step 6: Verify the `users` row was created**

In the Supabase Dashboard → Table Editor → `users`. Verify a row exists for your email with `role = 'member'` (or `admin` if you already set it in step 4) and `removed_at = NULL`.

- [ ] **Step 7: Verify session persists**

Refresh the page. Expected: still signed in (no redirect to login).

- [ ] **Step 8: Test sign-out (optional)**

Since there's no sign-out button yet (it comes in a later slice), you can test session expiry by clearing cookies in the browser's DevTools → Application → Cookies → delete all `sb-*` cookies. Reload: should redirect to `/login`.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Supabase Auth magic link sign-in (Task 6 + 9)
- ✅ `/auth/callback` handler exchanges code, creates `users` row (Task 6)
- ✅ `display_name` fallback to email prefix (Task 6, step 1)
- ✅ `ON CONFLICT DO NOTHING` on callback (Task 6, step 1)
- ✅ `role = 'member'` default; first admin set via Table Editor (ADR 0004, Task 10 step 4)
- ✅ `removed_at` checked in `getUser()` — removed user redirected to login (Task 4)
- ✅ Session refresh via `proxy.ts` on every request (Task 5)
- ✅ `lib/mock/auth-context.tsx` no longer used by any page (Tasks 7–9)
- ✅ `RoleSwitcher` deleted (Task 9)
- ✅ `invite/[token]` page deleted — no custom invite tokens (Task 9, ADR 0004)
- ✅ Service role client isolated in `lib/auth/admin.ts` — never imported client-side (Task 4)

**Out of scope for this slice (next slices):**
- Sign-out button (Members page or nav)
- Admin: generate magic links for other users
- Admin: soft-remove members
- Admin: promote/demote members
- Real expenses/contributions/members data (mock store still backs those pages)
