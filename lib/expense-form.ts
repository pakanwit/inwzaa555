import { z } from 'zod';
import type { ExpenseCategory, User } from './types';
import { parseBahtInput } from './money';

export const expenseFormSchema = z.object({
  description: z.string().min(1, 'Required'),
  amountBaht: z
    .string()
    .min(1, 'Required')
    .refine((v) => parseBahtInput(v) !== null && parseBahtInput(v)! > 0, {
      message: 'Enter a positive whole baht amount',
    }),
  category: z.enum(['food', 'transport', 'lodging', 'activity', 'other']),
  occurredAt: z.string().min(1, 'Required'),
  paidBy: z.string().min(1, 'Required'), // 'pot' or user id
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function payerOptions(currentUser: User, members: User[]) {
  const isAdmin = currentUser.role === 'admin';
  const active = members.filter((m) => !m.removedAt);
  if (isAdmin) {
    return [
      { value: 'pot', label: 'From the pot' },
      ...active.map((m) => ({
        value: m.id,
        label: `${m.displayName}${m.id === currentUser.id ? ' (me)' : ''} fronted`,
      })),
    ];
  }
  // Members can only record self-fronted expenses
  return [
    { value: currentUser.id, label: `${currentUser.displayName} (me) fronted` },
  ];
}

export const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'food', label: 'Food & drink' },
  { value: 'transport', label: 'Transport' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
];
