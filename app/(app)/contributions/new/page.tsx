import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/server'
import { getActiveUsers } from '@/lib/actions/contributions'
import NewContributionForm from './new-contribution-form'

export default async function NewContributionPage() {
  const currentUser = await getUser()
  if (currentUser.role !== 'admin') redirect('/contributions')
  const users = await getActiveUsers()
  return <NewContributionForm currentUser={currentUser} users={users} />
}
