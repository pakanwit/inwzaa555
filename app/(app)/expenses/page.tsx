'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { Select } from '@/components/y2k/select';
import { ExpenseRow, findFronter } from '@/components/features/expense-row';
import { useMockStore } from '@/lib/mock/store';
import type { ExpenseCategory } from '@/lib/mock/types';

const CATEGORIES: { value: ExpenseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'food', label: 'Food & drink' },
  { value: 'transport', label: 'Transport' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
];

export default function ExpensesPage() {
  const users = useMockStore((s) => s.users);
  const expenses = useMockStore((s) => s.expenses);
  const [cat, setCat] = useState<string>('all');
  const [payer, setPayer] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  const filtered = expenses
    .filter((e) => (cat === 'all' ? true : e.category === cat))
    .filter((e) => {
      if (payer === 'all') return true;
      if (payer === 'pot') return !e.frontedByUserId;
      return e.frontedByUserId === payer;
    })
    .filter((e) => {
      if (status === 'all') return true;
      if (status === 'unsettled')
        return !!e.frontedByUserId && !e.reimbursedAt;
      if (status === 'reimbursed') return !!e.reimbursedAt;
      if (status === 'pot') return !e.frontedByUserId;
      return true;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">Expenses</h1>
        <Link href="/expenses/new"><Button variant="primary">Add expense</Button></Link>
      </div>
      <Window title="Filters">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Category"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Select
            label="Paid by"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            options={[
              { value: 'all', label: 'Anyone' },
              { value: 'pot', label: 'Pot' },
              ...users.map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pot', label: 'From pot' },
              { value: 'unsettled', label: 'Unsettled fronts' },
              { value: 'reimbursed', label: 'Reimbursed' },
            ]}
          />
        </div>
      </Window>
      <ul className="space-y-1">
        {filtered.length === 0 ? (
          <li className="text-xs">No expenses match these filters.</li>
        ) : (
          filtered.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              fronterName={findFronter(users, e)}
            />
          ))
        )}
      </ul>
    </div>
  );
}
