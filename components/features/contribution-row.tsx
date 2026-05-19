import { formatBaht } from '@/lib/money';
import type { Contribution, User } from '@/lib/mock/types';

export function ContributionRow({
  contribution,
  user,
}: {
  contribution: Contribution;
  user?: User;
}) {
  return (
    <li className="bevel-in bg-white p-2 flex items-center justify-between gap-2">
      <div>
        <strong>{user?.displayName ?? contribution.userId}</strong>
        <div className="text-xs">
          {new Date(contribution.contributedAt).toLocaleDateString()}
          {contribution.note ? ` · ${contribution.note}` : ''}
        </div>
      </div>
      <strong>{formatBaht(contribution.amountCents)}</strong>
    </li>
  );
}
