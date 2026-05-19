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
| Auth | Supabase Auth — magic link, restricted by `allowed_emails` table |
| DB | Supabase Postgres |
| ORM | Drizzle |
| Storage | Supabase Storage (private bucket `receipts`, RLS-gated) |
| Styling | Tailwind CSS + hand-rolled Y2K component library (no shadcn, no 98.css) |
| Forms | React Hook Form + Zod |
| Money | Stored as integer cents (BIGINT), single currency THB in v1 |

## 4. Data Model

```sql
users (
  id            uuid PK (= supabase auth.users.id)
  email         text unique not null
  display_name  text not null
  avatar_url    text
  role          text not null default 'member'
                  check (role in ('admin','member'))
  removed_at    timestamptz       -- soft-remove: can't sign in, but history preserved
  created_at    timestamptz default now()
)

invite_tokens (
  id            uuid PK
  token         text unique not null     -- random 32-char url-safe
  created_by    uuid references users(id) not null
  created_at    timestamptz default now()
  expires_at    timestamptz not null     -- default created_at + 7 days
  used_by       uuid references users(id) -- NULL while unused
  used_at       timestamptz
  revoked_at    timestamptz               -- admin can kill a link before use
)

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
| `/login` | Magic link form. Rejects non-allowed emails before sending. |
| `/` | **Dashboard.** Pot total + remaining (big), suggested settlements ("Alice is owed ฿3,000"), recent expense feed (10 items), quick-add buttons. |
| `/expenses` | Full expense list. Filter by category, payer, reimbursement status. |
| `/expenses/new` | Add expense form: amount, description, category, occurred_at, paid_by (pot / me / other member), optional photo upload. |
| `/expenses/[id]` | Detail: receipt fullscreen viewer, edit, delete, "Mark reimbursed" button (if fronted & unsettled). |
| `/contributions` | List all contributions. |
| `/contributions/new` | Add contribution form: who (self for members, anyone for admins), amount, when, optional transfer-screenshot upload. |
| `/members` | Roster with role badges. Admin-only controls: generate/revoke invite link, copy link, soft-remove member, promote/demote. Members see read-only roster. |
| `/invite/[token]` | Public invite-acceptance page (no auth needed). Validates token, collects email + display name, sends magic link, marks token used on successful first login. |

## 7. Roles, Permissions & Access

### Roles

| Role | Granted at | Notes |
|---|---|---|
| `admin` | First user to sign in becomes admin automatically (bootstrap). Admins can promote/demote other members. | Cannot demote yourself if you are the last admin. |
| `member` | Default for everyone joining via invite link. | |

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

### Invite-link flow

1. Admin clicks "Generate invite link" on `/members` → server creates an `invite_tokens` row with a random 32-char token, 7-day expiry → link displayed as `https://<host>/invite/<token>` with a one-click copy button
2. Admin shares link via Line/WhatsApp/etc.
3. Friend opens link:
   - Server validates token (exists, not expired, not used, not revoked)
   - Friend enters email + display name → magic link sent
   - On successful magic-link login, server creates `users` row with `role='member'` and marks the token `used_by` + `used_at`
4. Admins can revoke an unused token from `/members` (sets `revoked_at`)
5. Tokens are single-use; each new friend needs their own link

### Enforcement

- **Server actions** are the only mutation path. Every action runs a permission check helper (`requireAdmin()`, `requireOwnerOrAdmin(record)`) before touching the DB. No client-side trust.
- **Supabase RLS** policies enforce the same rules at the DB layer as defense-in-depth (e.g., `UPDATE expenses` allowed when `auth.uid() = created_by OR auth.uid() IN (SELECT id FROM users WHERE role='admin')`).
- **No public sign-up route.** The only way in is `/invite/<token>` with a valid token.

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
- **Auth method:** magic link only, gated by single-use invite tokens
- **Roles:** `admin` and `member`; first signup auto-promoted to admin
- **Split logic:** equal share, implicit, computed from total ÷ member_count
- **UI base:** fully hand-rolled Y2K theme, no 98.css or shadcn
- **Currency:** THB only, stored as integer cents
- **Member removal:** soft-delete (`removed_at`) to preserve ledger integrity
