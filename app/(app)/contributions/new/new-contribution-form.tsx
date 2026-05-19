'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Select } from '@/components/y2k/select'
import { createContribution } from '@/lib/actions/contributions'
import { parseBahtInput } from '@/lib/money'
import type { User } from '@/lib/types'

const schema = z.object({
  userId: z.string().uuid(),
  amountBaht: z.string().min(1).refine(
    (v) => parseBahtInput(v) !== null && parseBahtInput(v)! > 0,
    { message: 'Enter a positive whole baht amount' },
  ),
  contributedAt: z.string().min(1),
  note: z.string().optional(),
})
type Values = z.infer<typeof schema>

export default function NewContributionForm({ currentUser, users }: { currentUser: User; users: User[] }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: currentUser.id,
      amountBaht: '',
      contributedAt: new Date().toISOString().slice(0, 10),
      note: '',
    },
  })

  const isAdmin = currentUser.role === 'admin'
  const memberOptions = users.map((u) => ({
    value: u.id,
    label: u.id === currentUser.id ? `${u.displayName} (me)` : u.displayName,
  }))

  async function onSubmit(v: Values) {
    setServerError(null)
    const result = await createContribution(v)
    if (result.ok) { router.push('/contributions'); router.refresh() }
    else setServerError(result.error)
  }

  return (
    <Window title="New contribution">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {isAdmin ? (
          <Select label="Contributor" options={memberOptions} error={errors.userId?.message} {...register('userId')} />
        ) : (
          <p className="text-xs">Adding on behalf of yourself ({currentUser.displayName}).</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Amount (THB)" inputMode="numeric" error={errors.amountBaht?.message} {...register('amountBaht')} />
          <TextInput label="Date" type="date" error={errors.contributedAt?.message} {...register('contributedAt')} />
        </div>
        <TextInput label="Note (optional)" {...register('note')} />
        {serverError ? <p className="text-y2k-magenta text-sm">{serverError}</p> : null}
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={isSubmitting}>Save</Button>
          <Button type="button" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </Window>
  )
}
