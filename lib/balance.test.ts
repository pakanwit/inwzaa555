import { describe, it, expect } from 'vitest';
import { computeBalances } from './balance';
import type { Contribution, Expense, User } from './types';

const u = (id: string, role: 'admin' | 'member' = 'member'): User => ({
  id,
  email: `${id}@example.com`,
  displayName: id,
  role,
  createdAt: '2026-05-19T00:00:00Z',
});

const c = (userId: string, amountCents: number): Contribution => ({
  id: `c-${userId}-${amountCents}`,
  userId,
  amountCents,
  contributedAt: '2026-05-19T00:00:00Z',
  createdBy: userId,
  createdAt: '2026-05-19T00:00:00Z',
  attachments: [],
});

const e = (
  amountCents: number,
  opts: { frontedBy?: string; reimbursed?: boolean } = {},
): Expense => ({
  id: `e-${Math.random()}`,
  amountCents,
  description: 'x',
  category: 'food',
  occurredAt: '2026-05-19T00:00:00Z',
  frontedByUserId: opts.frontedBy,
  reimbursedAt: opts.reimbursed ? '2026-05-19T00:00:00Z' : undefined,
  createdBy: opts.frontedBy ?? 'a',
  createdAt: '2026-05-19T00:00:00Z',
  attachments: [],
});

describe('computeBalances', () => {
  it('returns zeros for an empty trip', () => {
    const r = computeBalances({ users: [u('a')], contributions: [], expenses: [] });
    expect(r.potTotal).toBe(0);
    expect(r.potSpent).toBe(0);
    expect(r.potRemaining).toBe(0);
    expect(r.totalExpenses).toBe(0);
    expect(r.fairShare).toBe(0);
    expect(r.perUser['a']).toEqual({
      contributed: 0,
      owedUnsettled: 0,
      fairShare: 0,
      net: 0,
    });
  });

  it('counts contributions toward the pot', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [],
    });
    expect(r.potTotal).toBe(400000);
    expect(r.potRemaining).toBe(400000);
    expect(r.perUser['a']!.contributed).toBe(200000);
  });

  it('pot-paid expenses drain the pot', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(300000)], // paid from pot
    });
    expect(r.potSpent).toBe(300000);
    expect(r.potRemaining).toBe(100000);
    expect(r.totalExpenses).toBe(300000);
    expect(r.fairShare).toBe(150000); // 300000 / 2
  });

  it('fronted-and-unreimbursed expenses do NOT drain the pot but DO create an obligation', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(300000, { frontedBy: 'a' })],
    });
    expect(r.potSpent).toBe(0);
    expect(r.potRemaining).toBe(400000);
    expect(r.totalExpenses).toBe(300000); // still counts toward fair share
    expect(r.perUser['a']!.owedUnsettled).toBe(300000);
    expect(r.perUser['a']!.net).toBe(
      200000 /* contributed */ + 300000 /* owed back */ - 150000 /* fair share */,
    ); // = 350000
    expect(r.perUser['b']!.net).toBe(200000 - 150000); // = 50000
  });

  it('fronted-and-reimbursed expenses behave like pot-paid', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(300000, { frontedBy: 'a', reimbursed: true })],
    });
    expect(r.potSpent).toBe(300000);
    expect(r.potRemaining).toBe(100000);
    expect(r.perUser['a']!.owedUnsettled).toBe(0);
  });

  it('excludes removed users from member_count for fair share', () => {
    const removed = { ...u('c'), removedAt: '2026-05-19T01:00:00Z' };
    const r = computeBalances({
      users: [u('a'), u('b'), removed],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(400000)],
    });
    expect(r.fairShare).toBe(200000); // 400000 / 2 active members
  });

  it('integer-division remainder is absorbed by the pot (not double-counted)', () => {
    const r = computeBalances({
      users: [u('a'), u('b'), u('c')],
      contributions: [],
      expenses: [e(100000)], // 100000 / 3 = 33333 r1
    });
    expect(r.fairShare).toBe(33333);
    // Sum of fair shares < total — remainder of 1 cent stays in the pot bookkeeping
  });
});
