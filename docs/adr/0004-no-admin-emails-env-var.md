# First admin bootstrapped via Supabase Table Editor, not ADMIN_EMAILS env var

The design spec included an `ADMIN_EMAILS` env var checked on first sign-in to assign `role='admin'`. We dropped it. The auth callback always creates users as `role='member'`; the first admin is set by editing the `users.role` column directly in the Supabase Dashboard Table Editor. Subsequent admin management (promote/demote) happens through the Members page as designed.

Reason: the env var solved the chicken-and-egg bootstrap problem, but introduced a second mechanism for role assignment that could diverge from the DB role. A one-time manual edit in the Dashboard is simpler, has no moving parts, and the bootstrap only happens once before the trip.
