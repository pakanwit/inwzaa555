import Link from 'next/link';
import { formatBaht } from '@/lib/money';
import type { Expense, User } from '@/lib/types'
import { Badge } from '@/components/y2k/badge';

export function ExpenseRow({
  expense,
  fronterName,
}: {
  expense: Expense;
  fronterName?: string;
}) {
  return (
    <li className="bevel-in bg-white p-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <Link
          href={`/expenses/${expense.id}`}
          className="font-bold no-underline text-black hover:underline"
        >
          {expense.description}
        </Link>
        <div className="text-xs flex flex-wrap gap-1 items-center">
          <span>{new Date(expense.occurredAt).toLocaleDateString()}</span>
          <span>·</span>
          <span>{expense.category}</span>
          {expense.frontedByUserId ? (
            <Badge tone={expense.reimbursedAt ? 'good' : 'warning'}>
              {expense.reimbursedAt
                ? `Reimbursed (${fronterName ?? 'paid'})`
                : `Fronted by ${fronterName ?? 'member'}`}
            </Badge>
          ) : (
            <Badge>From pot</Badge>
          )}
        </div>
      </div>
      <strong>{formatBaht(expense.amountCents)}</strong>
    </li>
  );
}

export function findFronter(users: User[], expense: Expense): string | undefined {
  if (!expense.frontedByUserId) return undefined;
  return users.find((u) => u.id === expense.frontedByUserId)?.displayName;
}
