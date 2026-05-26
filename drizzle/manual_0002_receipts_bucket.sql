-- Receipts bucket: private, used for contribution slip images
-- (and, later, expense receipts). Run once in Supabase SQL editor.
-- Access is gated primarily by server-generated signed URLs; the policies
-- below are defense-in-depth for direct storage.objects access.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- SELECT: any active member can view slip images (Q4: friend group already
-- shares slips in their chat, so cross-member visibility is acceptable).
create policy "receipts_read_active_members" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.users
      where users.id = auth.uid() and users.removed_at is null
    )
  );

-- INSERT: only admins. Signed upload URLs technically bypass RLS, but this
-- protects against direct client uploads if a key ever leaks.
create policy "receipts_insert_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin' and users.removed_at is null
    )
  );

-- DELETE: only admins.
create policy "receipts_delete_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin' and users.removed_at is null
    )
  );
