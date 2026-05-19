# Login page uses email + password, not magic link OTP

The design spec originally called for a magic link OTP form on the `/login` page (`signInWithOtp` with `shouldCreateUser: false`). We switched to email + password (`signInWithPassword`) after hitting Supabase's email rate limit during development and finding that magic links add friction for subsequent sign-ins (the OTP page is only a fallback for expired sessions, not the primary flow).

Admin still provisions users via the Supabase Dashboard with auto-confirm email. The Members page generates a one-time magic link for the very first sign-in if needed (`auth.admin.generateLink`). After that, users sign in with their email + password. The `/auth/callback` route remains for the initial magic link onboarding flow.
