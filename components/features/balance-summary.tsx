'use client';
import { Window } from '@/components/y2k/window';
import { useMockStore } from '@/lib/mock/store';
import { computeBalances } from '@/lib/balance';
import { formatBaht } from '@/lib/money';

export function BalanceSummary() {
  const users = useMockStore((s) => s.users);
  const contributions = useMockStore((s) => s.contributions);
  const expenses = useMockStore((s) => s.expenses);
  const b = computeBalances({ users, contributions, expenses });

  return (
    <Window title="The Kitty">
      <div className="grid grid-cols-2 gap-3 text-center">
        <Stat label="Pot total" value={formatBaht(b.potTotal)} />
        <Stat
          label="Remaining cash"
          value={formatBaht(b.potRemaining)}
          accent
        />
        <Stat label="Spent so far" value={formatBaht(b.potSpent)} />
        <Stat label="Fair share / person" value={formatBaht(b.fairShare)} />
      </div>
    </Window>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bevel-in bg-white p-3">
      <div className="text-xs uppercase tracking-wide">{label}</div>
      <div
        className={`text-2xl font-bold ${accent ? 'text-y2k-blue' : 'text-black'}`}
      >
        {value}
      </div>
    </div>
  );
}
