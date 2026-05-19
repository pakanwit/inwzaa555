'use client';
import Link from 'next/link';
import { BalanceSummary } from '@/components/features/balance-summary';
import { OwedList } from '@/components/features/owed-list';
import { ExpenseRow, findFronter } from '@/components/features/expense-row';
import { Button } from '@/components/y2k/button';
import { useMockStore } from '@/lib/mock/store';

export default function DashboardPage() {
  const users = useMockStore((s) => s.users);
  const expenses = useMockStore((s) => s.expenses);
  const recent = [...expenses]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <BalanceSummary />
      <OwedList />
      <div className="md:col-span-2 bevel-out bg-y2k-chrome-200 p-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">Recent expenses</h2>
          <div className="flex gap-2">
            <Link href="/expenses/new"><Button variant="primary">Add expense</Button></Link>
            <Link href="/contributions/new"><Button>Add contribution</Button></Link>
          </div>
        </div>
        <ul className="space-y-1">
          {recent.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              fronterName={findFronter(users, e)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
