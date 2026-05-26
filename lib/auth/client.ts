'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import type { User } from '@/lib/types'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

// Module-level singleton — createBrowserClient caches by URL+key internally
const _browserClient = createSupabaseBrowserClient()

export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = _browserClient

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) { setUser(null); return }

      const { data: row, error: rowError } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url, role, removed_at, created_at')
        .eq('id', authUser.id)
        .single()

      if (rowError || !row || row.removed_at !== null) { setUser(null); return }

      setUser({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url ?? undefined,
        role: row.role as 'admin' | 'member',
        removedAt: row.removed_at ?? undefined,
        createdAt: row.created_at as string,
      })
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => loadUser())

    return () => subscription.unsubscribe()
  }, [])

  return user
}
