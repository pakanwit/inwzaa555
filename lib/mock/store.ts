'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  seedContributions,
  seedExpenses,
  seedInvites,
  seedUsers,
} from './seed';
import type {
  Contribution,
  Expense,
  InviteToken,
  User,
  UserId,
} from './types';

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type State = {
  users: User[];
  contributions: Contribution[];
  expenses: Expense[];
  invites: InviteToken[];
  resetToSeed: () => void;

  // expense actions
  addExpense: (input: Omit<Expense, 'id' | 'createdAt' | 'attachments'> & {
    attachments?: Expense['attachments'];
  }) => string;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  markExpenseReimbursed: (id: string, at?: string) => void;

  // contribution actions
  addContribution: (
    input: Omit<Contribution, 'id' | 'createdAt' | 'attachments'> & {
      attachments?: Contribution['attachments'];
    },
  ) => string;
  updateContribution: (id: string, patch: Partial<Contribution>) => void;
  deleteContribution: (id: string) => void;

  // member actions
  promoteToAdmin: (userId: UserId) => void;
  demoteToMember: (userId: UserId) => void;
  removeMember: (userId: UserId) => void;
  restoreMember: (userId: UserId) => void;

  // invite actions
  createInvite: (createdBy: UserId) => InviteToken;
  revokeInvite: (id: string) => void;
  consumeInvite: (
    token: string,
    user: { email: string; displayName: string },
  ) => User | null;
};

export const useMockStore = create<State>()(
  persist(
    (set, get) => ({
      users: seedUsers,
      contributions: seedContributions,
      expenses: seedExpenses,
      invites: seedInvites,

      resetToSeed: () =>
        set({
          users: seedUsers,
          contributions: seedContributions,
          expenses: seedExpenses,
          invites: seedInvites,
        }),

      addExpense: (input) => {
        const id = uid('e');
        const now = new Date().toISOString();
        const newExpense: Expense = {
          ...input,
          id,
          createdAt: now,
          attachments: input.attachments ?? [],
        };
        set({ expenses: [...get().expenses, newExpense] });
        return id;
      },
      updateExpense: (id, patch) =>
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        }),
      deleteExpense: (id) =>
        set({ expenses: get().expenses.filter((e) => e.id !== id) }),
      markExpenseReimbursed: (id, at = new Date().toISOString()) =>
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, reimbursedAt: at } : e,
          ),
        }),

      addContribution: (input) => {
        const id = uid('c');
        const now = new Date().toISOString();
        const newContribution: Contribution = {
          ...input,
          id,
          createdAt: now,
          attachments: input.attachments ?? [],
        };
        set({ contributions: [...get().contributions, newContribution] });
        return id;
      },
      updateContribution: (id, patch) =>
        set({
          contributions: get().contributions.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        }),
      deleteContribution: (id) =>
        set({
          contributions: get().contributions.filter((c) => c.id !== id),
        }),

      promoteToAdmin: (userId) =>
        set({
          users: get().users.map((u) =>
            u.id === userId ? { ...u, role: 'admin' } : u,
          ),
        }),
      demoteToMember: (userId) => {
        const admins = get().users.filter(
          (u) => u.role === 'admin' && !u.removedAt,
        );
        if (admins.length <= 1 && admins[0]?.id === userId) return; // last admin guard
        set({
          users: get().users.map((u) =>
            u.id === userId ? { ...u, role: 'member' } : u,
          ),
        });
      },
      removeMember: (userId) =>
        set({
          users: get().users.map((u) =>
            u.id === userId
              ? { ...u, removedAt: new Date().toISOString() }
              : u,
          ),
        }),
      restoreMember: (userId) =>
        set({
          users: get().users.map((u) =>
            u.id === userId ? { ...u, removedAt: undefined } : u,
          ),
        }),

      createInvite: (createdBy) => {
        const token = Array.from(
          crypto.getRandomValues(new Uint8Array(24)),
          (b) => b.toString(16).padStart(2, '0'),
        ).join('').slice(0, 32);
        const now = new Date();
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const invite: InviteToken = {
          id: uid('i'),
          token,
          createdBy,
          createdAt: now.toISOString(),
          expiresAt: expires.toISOString(),
        };
        set({ invites: [...get().invites, invite] });
        return invite;
      },
      revokeInvite: (id) =>
        set({
          invites: get().invites.map((i) =>
            i.id === id ? { ...i, revokedAt: new Date().toISOString() } : i,
          ),
        }),
      consumeInvite: (token, user) => {
        const invite = get().invites.find((i) => i.token === token);
        if (!invite) return null;
        if (invite.usedAt || invite.revokedAt) return null;
        if (new Date(invite.expiresAt).getTime() < Date.now()) return null;
        const now = new Date().toISOString();
        const newUser: User = {
          id: uid('u'),
          email: user.email,
          displayName: user.displayName,
          role: 'member',
          createdAt: now,
        };
        set({
          users: [...get().users, newUser],
          invites: get().invites.map((i) =>
            i.id === invite.id ? { ...i, usedBy: newUser.id, usedAt: now } : i,
          ),
        });
        return newUser;
      },
    }),
    {
      name: 'trip-kitty-mock',
      // SSR safety
      skipHydration: false,
    },
  ),
);
