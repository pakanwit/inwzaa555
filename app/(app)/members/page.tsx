import { getUser } from '@/lib/auth/server'
import { listMembers } from '@/lib/actions/members'
import MembersClient from './members-client'

export default async function MembersPage() {
  const [currentUser, members] = await Promise.all([getUser(), listMembers()])
  return <MembersClient currentUser={currentUser} members={members} />
}
