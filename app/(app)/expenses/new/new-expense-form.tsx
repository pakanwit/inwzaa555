'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Select } from '@/components/y2k/select'
import { createExpense } from '@/lib/actions/expenses'
import { expenseFormSchema, type ExpenseFormValues, payerOptions, CATEGORY_OPTIONS } from '@/lib/expense-form'
import type { User } from '@/lib/types'

export default function NewExpenseForm({ currentUser, users }: { currentUser: User; users: User[] }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: '',
      amountBaht: '',
      category: 'food',
      occurredAt: new Date().toISOString().slice(0, 10),
      paidBy: currentUser.role === 'admin' ? 'pot' : currentUser.id,
    },
  })

  const options = payerOptions(currentUser, users)

  async function onSubmit(values: ExpenseFormValues) {
    setServerError(null)
    const result = await createExpense(values)
    if (result.ok) { router.push('/expenses'); router.refresh() }
    else setServerError(result.error)
  }

  return (
    <Window title="New expense">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <TextInput label="Description" error={errors.description?.message} {...register('description')} />
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Amount (THB)" inputMode="numeric" error={errors.amountBaht?.message} {...register('amountBaht')} />
          <TextInput label="Date" type="date" error={errors.occurredAt?.message} {...register('occurredAt')} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select label="Category" error={errors.category?.message} options={CATEGORY_OPTIONS} {...register('category')} />
          <Select label="Paid by" error={errors.paidBy?.message} options={options} {...register('paidBy')} />
        </div>
        {serverError ? <p className="text-y2k-magenta text-sm">{serverError}</p> : null}
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={isSubmitting}>Save expense</Button>
          <Button type="button" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </Window>
  )
}
