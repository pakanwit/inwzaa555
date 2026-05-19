// lib/mock/seed.ts
import type {
  Contribution,
  Expense,
  InviteToken,
  User,
} from './types';

const now = '2026-05-19T10:00:00Z';

export const seedUsers: User[] = [
  { id: 'u-pak',  email: 'pak@example.com',  displayName: 'Pak',
    role: 'admin',  createdAt: '2026-05-18T08:00:00Z' },
  { id: 'u-ploy', email: 'ploy@example.com', displayName: 'Ploy',
    role: 'member', createdAt: '2026-05-18T08:30:00Z' },
  { id: 'u-tee',  email: 'tee@example.com',  displayName: 'Tee',
    role: 'member', createdAt: '2026-05-18T09:00:00Z' },
  { id: 'u-nan',  email: 'nan@example.com',  displayName: 'Nan',
    role: 'member', createdAt: '2026-05-18T09:30:00Z' },
];

export const seedContributions: Contribution[] = seedUsers.map((u, i) => ({
  id: `c-${u.id}`,
  userId: u.id,
  amountCents: 200_000, // ฿2,000
  contributedAt: `2026-05-19T0${8 + i}:00:00Z`,
  note: 'Trip kitty deposit',
  createdBy: u.id,
  createdAt: now,
  attachments: [],
}));

export const seedExpenses: Expense[] = [
  {
    id: 'e-breakfast',
    amountCents: 60_000, // ฿600
    description: 'Breakfast at the resort',
    category: 'food',
    occurredAt: '2026-05-19T09:30:00Z',
    frontedByUserId: undefined, // paid from pot
    createdBy: 'u-pak',
    createdAt: now,
    attachments: [],
  },
  {
    id: 'e-gas',
    amountCents: 80_000, // ฿800
    description: 'Gas — drive up',
    category: 'transport',
    occurredAt: '2026-05-19T07:00:00Z',
    frontedByUserId: 'u-tee', // tee paid out of pocket
    createdBy: 'u-tee',
    createdAt: now,
    attachments: [],
  },
  {
    id: 'e-dinner',
    amountCents: 300_000, // ฿3,000
    description: 'Dinner & drinks',
    category: 'food',
    occurredAt: '2026-05-19T19:00:00Z',
    frontedByUserId: 'u-ploy',
    reimbursedAt: undefined, // unsettled — sample for "Owed" UI
    createdBy: 'u-ploy',
    createdAt: now,
    attachments: [],
  },
];

export const seedInvites: InviteToken[] = [];
