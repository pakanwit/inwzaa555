'use client';
import Link from 'next/link';
import { Button } from '@/components/y2k/button';
import { ContributionRow } from '@/components/features/contribution-row';
import { useMockStore } from '@/lib/mock/store';

export default function ContributionsPage() {
  const users = useMockStore((s) => s.users);
  const contributions = useMockStore((s) => s.contributions);
  const sorted = [...contributions].sort((a, b) =>
    b.contributedAt.localeCompare(a.contributedAt),
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">Contributions</h1>
        <Link href="/contributions/new">
          <Button variant="primary">Add contribution</Button>
        </Link>
      </div>
      <ul className="space-y-1">
        {sorted.map((c) => (
          <ContributionRow
            key={c.id}
            contribution={c}
            user={users.find((u) => u.id === c.userId)}
          />
        ))}
      </ul>
    </div>
  );
}
