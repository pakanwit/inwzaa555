import type { User, Expense, Contribution } from './types';

export type Action =
  | 'expense.create.fromPot'
  | 'expense.create.frontedBySelf'
  | 'expense.create.frontedByOther'
  | 'expense.update'
  | 'expense.delete'
  | 'expense.markReimbursed'
  | 'contribution.create.self'
  | 'contribution.create.other'
  | 'contribution.update'
  | 'contribution.delete'
  | 'invite.create'
  | 'invite.revoke'
  | 'member.remove'
  | 'member.promote'
  | 'member.demote'
  | 'member.update'
  | 'member.delete.hard';

type ResourceMap = {
  'expense.update': { resource: Expense };
  'expense.delete': { resource: Expense };
  'expense.markReimbursed': { resource: Expense };
  'contribution.update': { resource: Contribution };
  'contribution.delete': { resource: Contribution };
};
type Ctx<A extends Action> = A extends keyof ResourceMap ? ResourceMap[A] : undefined;

export function can<A extends Action>(actor: User, action: A, ctx?: Ctx<A>): boolean {
  if (actor.removedAt) return false;
  const isAdmin = actor.role === 'admin';

  switch (action) {
    case 'expense.create.fromPot':
    case 'expense.create.frontedByOther':
    case 'expense.markReimbursed':
    // Contributions are admin-only end-to-end — see ADR 0007.
    case 'contribution.create.self':
    case 'contribution.create.other':
    case 'contribution.update':
    case 'contribution.delete':
    case 'invite.create':
    case 'invite.revoke':
    case 'member.remove':
    case 'member.promote':
    case 'member.demote':
    case 'member.update':
    case 'member.delete.hard':
      return isAdmin;

    case 'expense.create.frontedBySelf':
      return true;

    case 'expense.update':
    case 'expense.delete': {
      const e = (ctx as { resource: Expense }).resource;
      if (isAdmin) return true;
      const isOwner = e.frontedByUserId === actor.id || e.createdBy === actor.id;
      return isOwner && !e.reimbursedAt;
    }
  }

  return false;
}
