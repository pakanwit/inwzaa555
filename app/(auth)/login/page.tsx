'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Marquee } from '@/components/y2k/marquee'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (authError) {
      setError('Invalid email or password.')
      setBusy(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="p-6 max-w-md mx-auto mt-8">
      <Marquee>Welcome to inwzaa555 2026!!! Best viewed in Internet Explorer 6.</Marquee>
      <div className="h-3" />
      <Window title="Sign in to inwzaa555">
        <form onSubmit={send} className="flex flex-col gap-3">
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
          {error ? <p className="text-y2k-magenta text-sm">{error}</p> : null}
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-xs">No account? Ask an admin for access.</p>
      </Window>
    </main>
  )
}
