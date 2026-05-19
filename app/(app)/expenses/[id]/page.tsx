import { notFound } from 'next/navigation'
import { getExpenseById } from '@/lib/actions/expenses'
import { getUser } from '@/lib/auth/server'
import ExpenseDetail from './expense-detail'

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [currentUser, data] = await Promise.all([getUser(), getExpenseById(id)])
  if (!data) notFound()
  return <ExpenseDetail expense={data.expense} users={data.users} currentUser={currentUser} />
}
