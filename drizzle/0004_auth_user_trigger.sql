-- Trigger: auto-create public.users row when a new auth.users row is inserted.
-- Fires when admin creates a user via Dashboard or Admin API, so the users
-- table row exists immediately without waiting for the magic link callback.
-- display_name priority: user_metadata.display_name -> email prefix -> 'Member'
-- The /auth/callback INSERT ON CONFLICT DO NOTHING remains as a safety net.
--
-- Idempotent: uses CREATE OR REPLACE so re-running over an existing DB is
-- a no-op. Was previously applied as manual_0001_auth_user_trigger.sql.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''), SPLIT_PART(NEW.email, '@', 1), 'Member'),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
--> statement-breakpoint

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
