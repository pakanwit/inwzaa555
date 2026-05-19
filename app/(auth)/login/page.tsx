'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Marquee } from '@/components/y2k/marquee'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    setSent(true)
    setBusy(false)
  }

  return (
    <main className="p-6 max-w-md mx-auto mt-8">
      <Marquee>Welcome to inwzaa555 2026!!! Best viewed in Internet Explorer 6.</Marquee>
      <div className="h-3" />
      <Window title="Sign in to inwzaa555">
        {sent ? (
          <p>If your email is registered, a magic link is on its way. Check your inbox.</p>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-3">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </Button>
          </form>
        )}
        <p className="mt-4 text-xs">Not registered? Ask an admin for an invite.</p>
      </Window>
    </main>
  )
}
