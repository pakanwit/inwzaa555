import { describe, it, expect } from 'vitest';
import { can } from './permissions';
import type { User, Expense, Contribution } from './types';

const admin: User = {
  id: 'A', email: 'a@x', displayName: 'A', role: 'admin',
  createdAt: '2026-05-19T00:00:00Z',
};
const member: User = {
  id: 'M', email: 'm@x', displayName: 'M', role: 'member',
  createdAt: '2026-05-19T00:00:00Z',
};
const otherMember: User = {
  id: 'O', email: 'o@x', displayName: 'O', role: 'member',
  createdAt: '2026-05-19T00:00:00Z',
};

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  amountCents: 10000,
  description: 'x',
  category: 'food',
  occurredAt: '2026-05-19T00:00:00Z',
  frontedByUserId: 'M',
  reimbursedAt: undefined,
  createdBy: 'M',
  createdAt: '2026-05-19T00:00:00Z',
  attachments: [],
  ...overrides,
});

const contribution = (overrides: Partial<Contribution> = {}): Contribution => ({
  id: 'c1', userId: 'M', amountCents: 200000,
  contributedAt: '2026-05-19T00:00:00Z',
  createdBy: 'M', createdAt: '2026-05-19T00:00:00Z',
  attachments: [], ...overrides,
});

describe('permissions: expense actions', () => {
  it('admin can create any expense', () => {
    expect(can(admin, 'expense.create.fromPot')).toBe(true);
    expect(can(admin, 'expense.create.frontedBySelf')).toBe(true);
    expect(can(admin, 'expense.create.frontedByOther')).toBe(true);
  });
  it('member can create only self-fronted expenses', () => {
    expect(can(member, 'expense.create.frontedBySelf')).toBe(true);
    expect(can(member, 'expense.create.fromPot')).toBe(false);
    expect(can(member, 'expense.create.frontedByOther')).toBe(false);
  });
  it('admin can update or delete any expense', () => {
    expect(can(admin, 'expense.update', { resource: expense() })).toBe(true);
    expect(can(admin, 'expense.delete', { resource: expense() })).toBe(true);
  });
  it('member can update/delete only their own unreimbursed expense', () => {
    expect(can(member, 'expense.update', { resource: expense() })).toBe(true);
    expect(can(member, 'expense.delete', { resource: expense() })).toBe(true);
    expect(
      can(member, 'expense.update', {
        resource: expense({ reimbursedAt: '2026-05-19T01:00:00Z' }),
      }),
    ).toBe(false);
    expect(
      can(member, 'expense.update', { resource: expense({ frontedByUserId: 'O', createdBy: 'O' }) }),
    ).toBe(false);
  });
  it('only admin can mark reimbursed', () => {
    expect(can(admin, 'expense.markReimbursed', { resource: expense() })).toBe(true);
    expect(can(member, 'expense.markReimbursed', { resource: expense() })).toBe(false);
  });
});

describe('permissions: contribution actions', () => {
  it('member can manage own contribution', () => {
    expect(can(member, 'contribution.update', { resource: contribution() })).toBe(true);
    expect(can(member, 'contribution.delete', { resource: contribution() })).toBe(true);
  });
  it('member cannot manage another member\'s contribution', () => {
    expect(
      can(member, 'contribution.update', { resource: contribution({ userId: 'O', createdBy: 'O' }) }),
    ).toBe(false);
  });
  it('admin can manage any contribution', () => {
    expect(
      can(admin, 'contribution.update', { resource: contribution({ userId: 'O', createdBy: 'O' }) }),
    ).toBe(true);
  });
});

describe('permissions: member admin actions', () => {
  it('only admin can invite/remove/promote', () => {
    for (const action of ['invite.create', 'invite.revoke', 'member.remove', 'member.promote', 'member.demote'] as const) {
      expect(can(admin, action)).toBe(true);
      expect(can(member, action)).toBe(false);
    }
  });
});

describe('permissions: removed users have no write access', () => {
  it('removed admin loses powers', () => {
    const removed = { ...admin, removedAt: '2026-05-19T00:00:00Z' };
    expect(can(removed, 'invite.create')).toBe(false);
    expect(can(removed, 'expense.create.fromPot')).toBe(false);
  });
});
