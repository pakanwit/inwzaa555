# Plan: Admin-only Contributions with Slip + "Who Paid" Dashboard

**Date:** 2026-05-27
**Spec refs:** `docs/superpowers/specs/2026-05-19-trip-expense-tracker-design.md` §4, §6, §8
**ADR:** `docs/adr/0007-admin-only-contributions-with-required-slip.md`
**Context:** `CONTEXT.md` — Contribution, Slip, Attachment

## Goal

1. Admin records who has paid into the Pot, attaching a bank slip image. Required.
2. A "Who paid" view on the home dashboard shows per-member total contributed at a glance, visible to all Members.

Out of scope (deferred): edit/delete UX nuance, slip replacement flow, multiple slips per Contribution UI niceties (schema supports it; UI ships with single-file input first).

## Steps

### 1. DB migration — `attachments` table

New file: `drizzle/0002_attachments.sql` (and matching Drizzle schema in `lib/db/schema.ts`).

```sql
create table attachments (
  id            uuid primary key default gen_random_uuid(),
  parent_type   text not null check (parent_type in ('contribution','expense')),
  parent_id     uuid not null,
  storage_path  text not null,
  mime_type     text,
  uploaded_by   uuid not null references public.users(id),
  uploaded_at   timestamptz not null default now()
);
create index attachments_parent_idx on attachments (parent_type, parent_id);
alter table attachments enable row level security;
-- SELECT: any active member
-- INSERT/DELETE: admins only (matches who can create/delete contributions; expense attachments come later)
```

RLS policies mirror `contributions` — any signed-in active user can `SELECT`; only admins can `INSERT`/`DELETE`.

### 2. Supabase Storage bucket

`receipts` bucket, **private**. Storage RLS policies on `storage.objects`:
- `SELECT`: any active user in `public.users` (slip viewable by all Members, per Q4)
- `INSERT`: admins only (`public.users.role = 'admin'`)
- `DELETE`: admins only

Path convention from spec §8: `contribution/{contribution_id}/{uuid}.{ext}`.

Add to `drizzle/manual_*.sql` since bucket setup runs via Supabase SQL, not Drizzle.

### 3. Permissions update — `lib/permissions.ts`

Change `contribution.create.self` from `return true` to `return isAdmin`. Effectively: any non-admin loses the ability to create Contributions.

Optionally collapse `contribution.create.self` and `contribution.create.other` into a single `contribution.create` action — they now have identical rules. Keep the split if Expenses still need the distinction (they do: `expense.create.frontedBySelf` ≠ `frontedByOther`). For consistency, keep the split.

Edit/delete: remove `c.userId === actor.id` from the owner check so only admin or `createdBy` (always admin in new world) can mutate. In practice: admin-only.

### 4. Server action — `lib/actions/contributions.ts`

`createContribution` change:
- Accept a `FormData` (or a pre-uploaded `storagePath`) — pick the simpler path: client uploads to Storage first via a signed upload URL, then submits the `storage_path` to the action.
- Validate actor is admin (already enforced by `contribution.create.other`; remove the "self" branch that allowed members).
- In a transaction: `INSERT INTO contributions`, then `INSERT INTO attachments` with `parent_type='contribution'`, `parent_id=<new contribution id>`, `storage_path`, `uploaded_by=actor.id`. If the attachment insert fails, roll back the Contribution.
- Reject if no `storage_path` provided.

Add `getSignedUploadUrl(filename: string, mimeType: string)` server action:
- Admin-only.
- Validates mime in `['image/jpeg','image/png','image/webp','image/heic']` and filename extension matches.
- Returns Supabase signed upload URL + storage path (`contribution/_pending/{uuid}.{ext}` — moved to `contribution/{id}/...` after Contribution row inserts, OR generate the contribution UUID client-side and use it in the path upfront. Simpler: generate UUID client-side, use it as both the path segment and the Contribution `id`).

Add `getSignedDownloadUrl(storagePath: string)` server action:
- Any active user (matches Q4 — all members can view slips).
- TTL 1 hour per spec §8.

`listContributions` change: join `attachments` (where `parent_type='contribution'`), return `attachments: { id, storagePath }[]` on each Contribution instead of the current hardcoded `attachments: []`.

### 5. UI — `app/(app)/contributions/new/`

- **Gate the route**: in `page.tsx`, if `currentUser.role !== 'admin'`, redirect to `/contributions`. Hide the "Add contribution" button on the list page for non-admins.
- **Form changes** in `new-contribution-form.tsx`:
  - Add `<input type="file" accept="image/jpeg,image/png,image/webp,image/heic">` — required.
  - On submit: validate file size ≤ 5 MB client-side, generate contribution UUID client-side, request signed upload URL, upload file to Supabase Storage, then call `createContribution({ ..., id, storagePath })`.
  - Show inline preview of the chosen image before submit.
  - Show upload progress / error states.

### 6. UI — Contribution list shows slip

In `components/features/contribution-row.tsx`: add a thumbnail (or "View slip" link) that calls `getSignedDownloadUrl` on click and opens the image in a new tab. Lazy — don't pre-fetch URLs for every row.

### 7. Dashboard — "Who Paid" table

In `app/(app)/page.tsx`, add a new `Window` titled "Who paid into the Pot":

```
Alice    ฿4,000
Bob      ฿2,000
Carol    —
Dave     ฿2,000
```

- Source: aggregate `allContributions` by `userId`, list every active member (including those with zero — show "—").
- Order: by displayName ascending, or by sum descending. Pick **by sum descending** so the "haven't paid" rows naturally cluster at the bottom.
- No target column (Q6 decision).

### 8. CONTEXT.md & ADR

Already updated in this session:
- `CONTEXT.md` — Contribution redefined, Slip term added.
- `docs/adr/0007-admin-only-contributions-with-required-slip.md` — written.

Spec §6 (permissions table) should also be updated to reflect admin-only Contribution create — not blocking for ship, but worth a follow-up commit.

## Verification

- TypeScript clean (`npm run typecheck` or equivalent).
- Vitest suite green (existing 41 tests — permission tests will need updating for the contribution rule change).
- Manual smoke:
  1. Sign in as admin → add a contribution with a slip image → row appears in list with thumbnail → image opens via signed URL.
  2. Sign in as member → "Add contribution" button hidden → `/contributions/new` redirects to `/contributions`.
  3. Dashboard "Who paid" table shows expected sums; members with zero contributions show "—".
- Storage RLS: as a member, hit a signed download URL → 200. Try direct unsigned bucket access → 403.

## Risk / unknowns

- **Client-side UUID generation** must use a cryptographically secure generator (`crypto.randomUUID()`) to avoid collisions with `gen_random_uuid()` in PG. Standard browser API.
- **Failed upload after Contribution row insert** (or vice versa). Mitigation: insert Contribution + Attachment in a single transaction *after* a successful Storage upload. If the DB insert fails, the orphan file sits in storage — acceptable for a private-bucket toy app, but worth a cleanup job later if it becomes a habit.
- **HEIC support**: iOS users will be common (Thai friend group). Browsers can't render HEIC inline reliably. Solution for v1: accept the upload but render the "View slip" link as a download instead of a thumbnail when mime is `image/heic`. Better v2: convert to JPEG via Supabase image transformation.
