import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = request.nextUrl.origin
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

  // Insert users row on first sign-in; DO NOTHING on subsequent sign-ins (idempotent)
  try {
    await db
      .insert(users)
      .values({
        id: authUser.id,
        email: authUser.email,
        displayName,
        role: 'member',
      })
      .onConflictDoNothing()
  } catch {
    return NextResponse.redirect(new URL('/login', origin))
  }

  return NextResponse.redirect(new URL('/', origin))
}
