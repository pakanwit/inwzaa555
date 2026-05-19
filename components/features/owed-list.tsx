'use client';
import Link from 'next/link';
import { Window } from '@/components/y2k/window';
import { useMockStore } from '@/lib/mock/store';
import { formatBaht } from '@/lib/money';

export function OwedList() {
  const users = useMockStore((s) => s.users);
  const expenses = useMockStore((s) => s.expenses);
  const unsettled = expenses.filter(
    (e) => e.frontedByUserId && !e.reimbursedAt,
  );
  const byUser = new Map<string, number>();
  for (const e of unsettled) {
    byUser.set(
      e.frontedByUserId!,
      (byUser.get(e.frontedByUserId!) ?? 0) + e.amountCents,
    );
  }

  return (
    <Window title="Pot owes…">
      {byUser.size === 0 ? (
        <p>No outstanding reimbursements. ✔</p>
      ) : (
        <ul className="space-y-1">
          {[...byUser.entries()].map(([uid, cents]) => {
            const u = users.find((x) => x.id === uid);
            return (
              <li key={uid} className="flex justify-between">
                <span>{u?.displayName ?? uid}</span>
                <strong>{formatBaht(cents)}</strong>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 text-xs">
        <Link href="/expenses">View all expenses →</Link>
      </div>
    </Window>
  );
}
