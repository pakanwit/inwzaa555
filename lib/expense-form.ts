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

export const createExpenseInputSchema = expenseFormSchema
  .extend({
    // Optional: when present (e.g. uploaded a receipt first) it must match the
    // storage path prefix. When absent, the server generates a fresh uuid.
    id: z.string().uuid().optional(),
    receiptStoragePath: z.string().optional(),
    receiptMimeType: z
      .enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
      .optional(),
  })
  .refine(
    (v) => (v.receiptStoragePath == null) === (v.receiptMimeType == null),
    {
      message:
        'receiptStoragePath and receiptMimeType must be both present or both absent',
    },
  )
  .refine((v) => !v.receiptStoragePath || v.id != null, {
    message: 'id is required when a receipt is attached',
  });

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'food',
  'transport',
  'lodging',
  'activity',
  'other',
];
