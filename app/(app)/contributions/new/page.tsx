import { getUser } from '@/lib/auth/server'
import { getActiveUsers } from '@/lib/actions/contributions'
import NewContributionForm from './new-contribution-form'

export default async function NewContributionPage() {
  const [currentUser, users] = await Promise.all([getUser(), getActiveUsers()])
  return <NewContributionForm currentUser={currentUser} users={users} />
}
