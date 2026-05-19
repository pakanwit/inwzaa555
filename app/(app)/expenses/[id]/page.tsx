'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { Badge } from '@/components/y2k/badge';
import { Dialog } from '@/components/y2k/dialog';
import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';
import { formatBaht } from '@/lib/money';
import { can } from '@/lib/permissions';

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const users = useMockStore((s) => s.users);
  const expense = useMockStore((s) =>
    s.expenses.find((e) => e.id === params?.id),
  );
  const markReimbursed = useMockStore((s) => s.markExpenseReimbursed);
  const deleteExpense = useMockStore((s) => s.deleteExpense);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!currentUser) return null;
  if (!expense)
    return (
      <Window title="Not found">
        <p>That expense no longer exists.</p>
      </Window>
    );

  const fronter = expense.frontedByUserId
    ? users.find((u) => u.id === expense.frontedByUserId)
    : null;
  const canEdit = can(currentUser, 'expense.update', { resource: expense });
  const canDelete = can(currentUser, 'expense.delete', { resource: expense });
  const canReimburse = can(currentUser, 'expense.markReimbursed', {
    resource: expense,
  });

  return (
    <Window title={expense.description}>
      <div className="flex flex-col gap-3">
        <div className="text-3xl font-bold text-y2k-blue">
          {formatBaht(expense.amountCents)}
        </div>
        <div className="text-xs flex flex-wrap gap-1 items-center">
          <Badge>{expense.category}</Badge>
          {fronter ? (
            <Badge tone={expense.reimbursedAt ? 'good' : 'warning'}>
              {expense.reimbursedAt
                ? `Reimbursed to ${fronter.displayName}`
                : `Fronted by ${fronter.displayName}`}
            </Badge>
          ) : (
            <Badge>Paid from pot</Badge>
          )}
          <span>·</span>
          <span>{new Date(expense.occurredAt).toLocaleDateString()}</span>
        </div>
        <p className="text-xs">
          (Receipt image preview appears here once storage is wired up.)
        </p>

        <div className="flex flex-wrap gap-2 mt-2">
          {fronter && !expense.reimbursedAt && canReimburse ? (
            <Button
              variant="primary"
              onClick={() => markReimbursed(expense.id)}
            >
              Mark reimbursed
            </Button>
          ) : null}
          {canEdit ? <Button disabled>Edit (TODO)</Button> : null}
          {canDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : null}
          <Button onClick={() => router.push('/expenses')}>Back</Button>
        </div>
      </div>
      <Dialog
        open={confirmDelete}
        title="Delete expense?"
        onClose={() => setConfirmDelete(false)}
      >
        <p className="mb-3">
          This will remove "<strong>{expense.description}</strong>" from the
          ledger.
        </p>
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              deleteExpense(expense.id);
              router.push('/expenses');
            }}
          >
            Yes, delete
          </Button>
        </div>
      </Dialog>
    </Window>
  );
}
