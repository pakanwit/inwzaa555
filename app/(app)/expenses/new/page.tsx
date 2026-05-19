'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { Select } from '@/components/y2k/select';
import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';
import { parseBahtInput } from '@/lib/money';
import {
  expenseFormSchema,
  type ExpenseFormValues,
  payerOptions,
  CATEGORY_OPTIONS,
} from '@/lib/expense-form';

export default function NewExpensePage() {
  const { currentUser } = useAuth();
  const users = useMockStore((s) => s.users);
  const addExpense = useMockStore((s) => s.addExpense);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: '',
      amountBaht: '',
      category: 'food',
      occurredAt: new Date().toISOString().slice(0, 10),
      paidBy: currentUser?.role === 'admin' ? 'pot' : (currentUser?.id ?? ''),
    },
  });

  if (!currentUser) return null;
  const user = currentUser;
  const options = payerOptions(user, users);

  function onSubmit(values: ExpenseFormValues) {
    const cents = parseBahtInput(values.amountBaht)!;
    const frontedBy = values.paidBy === 'pot' ? undefined : values.paidBy;
    addExpense({
      amountCents: cents,
      description: values.description,
      category: values.category,
      occurredAt: new Date(values.occurredAt).toISOString(),
      frontedByUserId: frontedBy,
      createdBy: user.id,
    });
    router.push('/expenses');
  }

  return (
    <Window title="New expense">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <TextInput
          label="Description"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Amount (THB)"
            inputMode="numeric"
            error={errors.amountBaht?.message}
            {...register('amountBaht')}
          />
          <TextInput
            label="Date"
            type="date"
            error={errors.occurredAt?.message}
            {...register('occurredAt')}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Category"
            error={errors.category?.message}
            options={CATEGORY_OPTIONS}
            {...register('category')}
          />
          <Select
            label="Paid by"
            error={errors.paidBy?.message}
            options={options}
            {...register('paidBy')}
          />
        </div>
        <p className="text-xs">
          (Receipt upload comes online when backend is wired up.)
        </p>
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            Save expense
          </Button>
          <Button type="button" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Window>
  );
}
