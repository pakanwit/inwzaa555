# public.users row created by Postgres trigger, not only by /auth/callback

The original design created the `public.users` row only inside `/auth/callback` — the first time a user clicked their magic link. This required users to actually sign in before their row existed, which broke the Members page roster and caused confusion during admin setup.

We added a Postgres trigger `on_auth_user_created` (AFTER INSERT on `auth.users`) that automatically creates the corresponding `public.users` row whenever an admin adds a user via the Supabase Dashboard or Admin API. The trigger derives `display_name` from `user_metadata.display_name`, falling back to the email prefix. The `/auth/callback` insert is kept as a `ON CONFLICT DO NOTHING` safety net for users created before the trigger existed.
