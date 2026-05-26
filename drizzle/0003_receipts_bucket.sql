-- Custom migration: receipts bucket + RLS policies on storage.objects.
-- Drizzle does not model Supabase Storage in its schema, so this is a
-- --custom migration. Safe to re-run thanks to DROP POLICY IF EXISTS
-- and ON CONFLICT DO NOTHING.

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- SELECT: any active member can view slip images. The friend group already
-- shares slips in their chat, so cross-member visibility is acceptable.
DROP POLICY IF EXISTS "receipts_read_active_members" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "receipts_read_active_members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.removed_at IS NULL
    )
  );
--> statement-breakpoint

-- INSERT: only admins. Signed upload URLs technically bypass RLS, but this
-- protects against direct client uploads if a key ever leaks.
DROP POLICY IF EXISTS "receipts_insert_admin" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "receipts_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.removed_at IS NULL
    )
  );
--> statement-breakpoint

-- DELETE: only admins.
DROP POLICY IF EXISTS "receipts_delete_admin" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "receipts_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.removed_at IS NULL
    )
  );
