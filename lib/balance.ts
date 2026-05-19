import type { Contribution, Expense, User, UserId } from './types';

export type PerUserBalance = {
  contributed: number;
  owedUnsettled: number;
  fairShare: number;
  net: number;
};

export type BalanceSnapshot = {
  potTotal: number;
  potSpent: number;
  potRemaining: number;
  totalExpenses: number;
  fairShare: number;
  perUser: Record<UserId, PerUserBalance>;
};

export function computeBalances(input: {
  users: User[];
  contributions: Contribution[];
  expenses: Expense[];
}): BalanceSnapshot {
  const { users, contributions, expenses } = input;
  const activeUsers = users.filter((u) => !u.removedAt);

  const potTotal = contributions.reduce((s, c) => s + c.amountCents, 0);

  const potSpent = expenses
    .filter((e) => e.frontedByUserId === undefined || e.reimbursedAt !== undefined)
    .reduce((s, e) => s + e.amountCents, 0);

  const totalExpenses = expenses.reduce((s, e) => s + e.amountCents, 0);
  const memberCount = activeUsers.length || 1;
  const fairShare = Math.trunc(totalExpenses / memberCount);

  const perUser: Record<UserId, PerUserBalance> = {};
  for (const u of users) {
    const contributed = contributions
      .filter((c) => c.userId === u.id)
      .reduce((s, c) => s + c.amountCents, 0);
    const owedUnsettled = expenses
      .filter(
        (e) => e.frontedByUserId === u.id && e.reimbursedAt === undefined,
      )
      .reduce((s, e) => s + e.amountCents, 0);
    const share = u.removedAt ? 0 : fairShare;
    perUser[u.id] = {
      contributed,
      owedUnsettled,
      fairShare: share,
      net: contributed + owedUnsettled - share,
    };
  }

  return {
    potTotal,
    potSpent,
    potRemaining: potTotal - potSpent,
    totalExpenses,
    fairShare,
    perUser,
  };
}
