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
  | 'member.demote';

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
    case 'contribution.create.other':
    case 'invite.create':
    case 'invite.revoke':
    case 'member.remove':
    case 'member.promote':
    case 'member.demote':
      return isAdmin;

    case 'expense.create.frontedBySelf':
    case 'contribution.create.self':
      return true;

    case 'expense.update':
    case 'expense.delete': {
      const e = (ctx as { resource: Expense }).resource;
      if (isAdmin) return true;
      const isOwner = e.frontedByUserId === actor.id || e.createdBy === actor.id;
      return isOwner && !e.reimbursedAt;
    }

    case 'contribution.update':
    case 'contribution.delete': {
      const c = (ctx as { resource: Contribution }).resource;
      if (isAdmin) return true;
      return c.userId === actor.id || c.createdBy === actor.id;
    }
  }

  return false;
}
