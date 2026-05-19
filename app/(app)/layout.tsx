import { AppShell } from '@/components/app-shell'
import { getUser } from '@/lib/auth/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  return <AppShell currentUser={user}>{children}</AppShell>
}
