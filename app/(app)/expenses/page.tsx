import { listExpenses } from '@/lib/actions/expenses'
import ExpensesClient from './expenses-client'

export default async function ExpensesPage() {
  const { expenses, users } = await listExpenses()
  return <ExpensesClient expenses={expenses} users={users} />
}
