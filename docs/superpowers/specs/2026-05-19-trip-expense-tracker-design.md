# Trip Expense Tracker — Design Spec

**Date:** 2026-05-19
**Author:** Pakanwit (with Claude)
**Status:** Draft, pending approval

## 1. Purpose

A private web app for a 2-day-1-night trip with a small group of friends. Tracks a shared cash kitty, lets members log expenses (from pot or out-of-pocket), uploads receipt photos, and shows who is owed how much. Y2K visual theme. Mobile + desktop responsive. Friends-only access.

## 2. Mental Model: Shared Kitty

- Each member contributes an amount (e.g., 2000 baht) to a **central pot**
- Expenses are paid **from the pot** by default
- If a member pays **out-of-pocket** (because the pot didn't have cash on hand), the expense is **fronted** and that member is owed reimbursement from the pot
- "Reimbursement" is marked as a single boolean state on the expense — when set, the pot has paid that member back
- Fair share = total expenses ÷ member count (equal split, no custom shares in v1)

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| Hosting | Vercel (Fluid Compute) |
| Auth | Supabase Auth — **admin-provisioned users** (no public sign-up); friend lands signed in via emailed/copied magic link; never types email after that |
| DB | Supabase Postgres (project ref `spcppkmqhvjcwhayeldt`) |
| ORM | Drizzle |
| Storage | Supabase Storage (private bucket `receipts`, RLS-gated) |
| Styling | Tailwind CSS + hand-rolled Y2K component library (no shadcn, no 98.css) |
| Forms | React Hook Form + Zod |
| Money | Stored as integer cents (BIGINT), single currency THB in v1 |
| Admin bootstrap | `ADMIN_EMAILS` env var — comma-separated list. First sign-in syncs the user into `users` table with `role='admin'` if email matches, else `role='member'`. |

## 4. Data Model

```sql
-- Note: Supabase manages auth.users automatically. The users table below
-- is OUR application-level profile, joined 1:1 with auth.users by id.

users (
  id            uuid PK references auth.users(id) on delete cascade
  email         text unique not null     -- mirrored from auth.users for display in members page
  display_name  text not null
  avatar_url    text
  role          text not null default 'member'
                  check (role in ('admin','member'))
  removed_at    timestamptz       -- soft-remove: can't sign in (we revoke their auth.users session), but history preserved
  created_at    timestamptz default now()
)

-- invite_tokens table dropped — Supabase Auth's built-in invite mechanism
-- (admin generates magic links via the Admin API) replaces it entirely.

contributions (
  id              uuid PK
  user_id         uuid references users(id)
  amount_cents    bigint not null check (amount_cents > 0)
  contributed_at  timestamptz not null
  note            text
  created_by      uuid references users(id)
  created_at      timestamptz default now()
)

expenses (
  id                  uuid PK
  amount_cents        bigint not null check (amount_cents > 0)
  description         text not null
  category            text  -- 'food', 'transport', 'lodging', 'activity', 'other'
  occurred_at         timestamptz not null
  fronted_by_user_id  uuid references users(id)  -- NULL = paid from pot cash
  reimbursed_at       timestamptz                -- NULL = not yet reimbursed
  created_by          uuid references users(id) not null
  created_at          timestamptz default now()
)

attachments (
  id            uuid PK
  parent_type   text not null check (parent_type in ('expense','contribution'))
  parent_id     uuid not null
  storage_path  text not null  -- path in supabase storage 'receipts' bucket
  mime_type     text
  uploaded_by   uuid references users(id)
  uploaded_at   timestamptz default now()
)
```

**Indices:** `expenses(occurred_at desc)`, `expenses(fronted_by_user_id) where reimbursed_at is null`, `contributions(user_id)`, `attachments(parent_type, parent_id)`, `invite_tokens(token)`.

**Row Level Security:** every table requires the requesting user to exist in `users` with `removed_at IS NULL`. Write permissions are scoped by role + ownership — see §7.

## 5. Balance Math

```
pot_total      = Σ contributions.amount_cents
pot_spent      = Σ expenses where fronted_by_user_id IS NULL
               + Σ expenses where reimbursed_at IS NOT NULL
pot_remaining  = pot_total − pot_spent

total_expenses = Σ all expenses.amount_cents
fair_share     = total_expenses / member_count   (integer division; remainder absorbed by pot)

for each user u:
  contributed        = Σ contributions where user_id = u
  owed_unsettled     = Σ expenses where fronted_by_user_id = u AND reimbursed_at IS NULL
  net_position       = contributed + owed_unsettled − fair_share
```

`net_position > 0` → member has money coming back to them at trip end.
`net_position < 0` → member owes the pot at trip end.

These derived values are computed in a single SQL view `v_balances` rather than stored.

## 6. Pages

| Route | Purpose |
|---|---|
| `/login` | Renders a "tap to sign in" page when the user lands here without a Supabase session — primary purpose is to provide a fallback if a magic link expires; new users normally never visit this route. |
| `/auth/callback` | Supabase magic-link callback handler. Exchanges the `code` query param for a session, ensures a `users` row exists (creates it with role from `ADMIN_EMAILS` allowlist on first sign-in), redirects to `/`. |
| `/` | **Dashboard.** Pot total + remaining (big), suggested settlements ("Alice is owed ฿3,000"), recent expense feed (10 items), quick-add buttons. |
| `/expenses` | Full expense list. Filter by category, payer, reimbursement status. |
| `/expenses/new` | Add expense form: amount, description, category, occurred_at, paid_by (pot / me / other member), optional photo upload. |
| `/expenses/[id]` | Detail: receipt fullscreen viewer, edit, delete, "Mark reimbursed" button (if fronted & unsettled). |
| `/contributions` | List all contributions. |
| `/contributions/new` | Add contribution form: who (self for members, anyone for admins), amount, when, optional transfer-screenshot upload. |
| `/members` | Roster with role badges. Admin-only controls: "Copy magic link" (calls Supabase Admin API to generate a fresh link for that user), soft-remove member, promote/demote. Members see read-only roster. |

## 7. Roles, Permissions & Access

### Roles

| Role | Granted at | Notes |
|---|---|---|
| `admin` | On first sign-in, the user's email is checked against the `ADMIN_EMAILS` env allowlist; if it matches, the new `users` row is created with `role='admin'`. After bootstrap, admins promote/demote others via the Members page. | Cannot demote yourself if you are the last admin. |
| `member` | Default for everyone whose email isn't in `ADMIN_EMAILS` on first sign-in. | |

A user with `removed_at IS NOT NULL` is **soft-removed**: cannot sign in, cannot mutate anything, but their expense/contribution history stays in the ledger (so balances remain correct).

### Permission matrix

| Action | Member | Admin |
|---|---|---|
| View dashboard, balances, expenses, contributions | ✅ | ✅ |
| Create expense fronted by **self** (with receipt) | ✅ | ✅ |
| Create expense paid from pot (no fronter) | ❌ | ✅ |
| Create expense fronted by **another** member | ❌ | ✅ |
| Update/delete **own** expense (while not reimbursed) | ✅ | ✅ |
| Update/delete **another member's** expense | ❌ | ✅ |
| Mark expense reimbursed | ❌ | ✅ |
| Create **own** contribution (with transfer evidence) | ✅ | ✅ |
| Update/delete **own** contribution | ✅ | ✅ |
| Update/delete **another member's** contribution | ❌ | ✅ |
| Upload/delete attachments on records they can edit | ✅ (own records only) | ✅ (any) |
| Generate / revoke invite link | ❌ | ✅ |
| Remove member (soft) | ❌ | ✅ |
| Promote member → admin, demote admin → member | ❌ | ✅ |

Rule of thumb: **members own their own evidence; admins own the group.**

### Onboarding flow (revised — admin-provisioned via Supabase Auth)

1. Admin opens the Supabase Dashboard → Authentication → Users → "Add user" → enters the friend's email (placeholder OK if Supabase generates the invite link instead of emailing it). Sets `user_metadata.display_name` while creating.
2. **Either** Supabase emails the invite link automatically (if the email is real), **or** the admin grabs a fresh magic link from the Members page in our app, which calls the Supabase Admin API (`auth.admin.generateLink({ type: 'magiclink', email })`) and copies it to the clipboard for sharing on Line/WhatsApp.
3. Friend opens the link → lands on `/auth/callback` → session created → our callback handler upserts a `users` row using the email's match against `ADMIN_EMAILS` to decide the role → redirect to `/`.
4. Subsequent visits: the friend's device already has a Supabase session (default ~1-year refresh token) — they go straight to `/`. No login form, no email entry.
5. To kick someone out, admin sets `removed_at` (soft-remove) AND calls `auth.admin.deleteUser(id)` to revoke their Supabase session. Their ledger history stays intact.

### Enforcement

- **Server actions** are the only mutation path. Every action runs a permission check helper (`requireAdmin()`, `requireOwnerOrAdmin(record)`) before touching the DB. No client-side trust.
- **Supabase RLS** policies enforce the same rules at the DB layer as defense-in-depth (e.g., `UPDATE expenses` allowed when `auth.uid() = created_by OR auth.uid() IN (SELECT id FROM users WHERE role='admin')`).
- **No public sign-up route.** New users only exist if an admin creates them in the Supabase dashboard or via our Members page (which proxies to the Supabase Admin API behind an admin-only server action).

## 8. Image Storage

- Bucket: `receipts`, private
- Path convention: `{parent_type}/{parent_id}/{uuid}.{ext}`
- Upload: client gets a signed upload URL from a server action, uploads directly to Supabase Storage, then writes a row to `attachments`
- Read: signed download URL with 1-hour TTL, generated server-side per request
- Max 5MB per image, accepted MIME: `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- Thumbnails generated on-the-fly via Supabase image transformation (`?width=400&height=400&resize=cover`)

## 9. Y2K Visual Theme

### Aesthetic anchors
- Chrome/silver gradient surfaces, beveled borders (light top/left, dark bottom/right)
- "Window" containers with title bars, fake min/max/close buttons in the corner
- Glossy "Aqua-style" highlights on primary action buttons
- System fonts: `Tahoma, "MS Sans Serif", Verdana, Arial, sans-serif`
- Bright accent colors: hot blue (#0048D6), lime (#9FFF00), magenta (#FF00C8), highlighter yellow (#FFFA3D)
- Underlined blue links
- Status-bar footer with a faux clock
- Subtle dotted-focus rings (not modern blue outlines)
- Sparingly: animated GIFs, a `<marquee>` for the "trip kitty" header

### Component library (hand-rolled in `components/y2k/`)
- `Window` — title-bar + body container
- `Fieldset` — labeled bordered group
- `Button` — beveled, three variants (default, primary glossy, danger)
- `TextInput`, `Select`, `Textarea` — inset bevel, white background
- `StatusBar` — bottom footer
- `Tabs` — folder-tab look
- `Dialog` — modal window with title bar
- `Spinner` — animated hourglass GIF or pixel-style spinner
- `Marquee` — wraps native `<marquee>` with React props
- `ImageThumb` — beveled frame around image with hover zoom

### Responsive strategy
- Desktop (`>= 768px`): windows render with fixed max-width, centered, drop-shadow, faux title bar
- Mobile (`< 768px`): windows fill the viewport edge-to-edge, title bar becomes the page header, no drop shadow
- Tap targets ≥ 44×44px on mobile
- Forms stack vertically on mobile; two-column on desktop where helpful

### No dark mode.

## 10. Project Structure

```
the-rich-boys/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # auth guard + nav
│   │   ├── page.tsx                # dashboard
│   │   ├── expenses/
│   │   ├── contributions/
│   │   └── members/
│   └── api/                        # signed-upload endpoints
├── components/
│   ├── y2k/                        # Y2K component library
│   └── features/                   # expense card, balance widget, etc.
├── lib/
│   ├── db/                         # drizzle schema + client
│   ├── auth/                       # supabase server/client helpers
│   ├── storage/                    # signed URL helpers
│   └── money.ts                    # cents <-> baht formatting
├── drizzle/                        # generated migrations
├── public/y2k/                     # GIFs, sound effects, cursor
└── docs/superpowers/specs/
```

## 10a. Environments & Migrations

**Single Supabase project for both dev and prod (v1).** No local Supabase / Docker. Local `npm run dev` and Vercel production both connect to the same remote project `spcppkmqhvjcwhayeldt`.

| Env | Connects to | Distinguished by |
|---|---|---|
| **Local dev** (`npm run dev`) | `spcppkmqhvjcwhayeldt` | `.env.local` |
| **Vercel preview** | `spcppkmqhvjcwhayeldt` | Vercel env (Preview) |
| **Vercel production** | `spcppkmqhvjcwhayeldt` | Vercel env (Production) |

**Trade-off accepted:** dev/test inserts share rows with eventual production data. For a private friend-group trip app this is fine — we'll seed a small set of throwaway expenses during development and clean them up before the trip starts. If we later need isolation, we can either (a) provision a second Supabase project for `prod`, or (b) opt into Supabase Branching on the Pro plan.

**Migrations:** Drizzle generates SQL into `drizzle/`. Applied to the remote project via the **Supabase MCP** (`apply_migration` tool) during development, and via `supabase db push` from CI for repeatable deployments. Every migration is committed to git.

**Pre-trip cutover:** before sharing the app with the friend group, run a cleanup migration / seed script to wipe test data, then provision the real admin emails into Supabase Auth via the dashboard.

**Env-var contract:**
```
# .env.local AND Vercel envs (both Preview and Production) — same values
NEXT_PUBLIC_SUPABASE_URL=https://spcppkmqhvjcwhayeldt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>            # server-only, never exposed
DATABASE_URL=postgresql://postgres:<password>@db.spcppkmqhvjcwhayeldt.supabase.co:5432/postgres
ADMIN_EMAILS=<comma-separated admin emails>
```

**Service role key safety:** only used inside server actions / API routes for admin operations (issuing magic links, deleting users). Never imported into a client component. Vercel will warn if it leaks.

## 11. Error Handling

- Server actions wrap DB calls in try/catch and return discriminated-union results `{ ok: true, data } | { ok: false, error }`
- Forms display field-level errors from Zod and toast on server errors
- Image uploads show progress and a clear failure state with retry
- Unauthorized access redirects to `/login`
- 404 page styled as a "blue screen of death" (Y2K bonus)

## 12. Testing Strategy

- **Unit:** balance math (`lib/balance.ts`) — pure function, table-driven tests covering empty state, only contributions, only expenses, mixed fronted/reimbursed, integer-division remainder
- **Integration:** Drizzle queries against a local Supabase, seeded with fixtures, asserting `v_balances` view output
- **Component:** Y2K components render with correct ARIA roles and keyboard focus
- **Permission tests:** dedicated suite asserting the permission matrix from §7 — for each (role × action × ownership) combination, server action must allow or reject correctly. Run against test DB with RLS enabled to verify both layers.
- **E2E (Playwright, smoke only):** invite-link → sign-in flow, add-expense flow, mark-reimbursed flow, attempt-edit-others-expense-as-member (must fail) on mobile + desktop viewports

## 13. Out of Scope for v1

Listed explicitly to prevent scope creep:
- Multi-currency (only THB)
- Multiple trips (schema agnostic, but no UI)
- Custom split percentages
- Partial reimbursements
- Recurring expenses
- Push notifications / email digests
- Activity log / edit history
- CSV export
- Comments on expenses
- Dark mode

## 14. Open Questions Resolved

- **Trip count:** single hardcoded trip in v1; no `trips` table
- **Auth method:** Supabase Auth magic link; users provisioned by admin via Supabase Dashboard or Members page (`auth.admin.generateLink`); no custom invite_tokens, no public sign-up, no email entry on the friend's side after first link tap
- **Initial admins:** comma-separated `ADMIN_EMAILS` env var; checked on first sign-in to assign role
- **Multiple admins:** supported from day one (no role-count limits)
- **Split logic:** equal share, implicit, computed from total ÷ member_count
- **UI base:** fully hand-rolled Y2K theme, no 98.css or shadcn
- **Currency:** THB only, stored as integer cents
- **Member removal:** soft-delete (`removed_at`) on our users table + `auth.admin.deleteUser` to revoke Supabase session
- **Project name:** `inwzaa555`
- **Dev/prod DBs:** single remote Supabase project (`spcppkmqhvjcwhayeldt`) used for local dev, Vercel preview, and Vercel production in v1. Pre-trip cleanup planned. Local Docker setup skipped to save friction; can split later if isolation becomes needed.
