'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { Select } from '@/components/y2k/select';
import { useCurrentUser } from '@/lib/auth/client';
import { useMockStore } from '@/lib/mock/store';
import { parseBahtInput } from '@/lib/money';

const schema = z.object({
  userId: z.string().min(1),
  amountBaht: z
    .string()
    .min(1)
    .refine((v) => parseBahtInput(v) !== null && parseBahtInput(v)! > 0, {
      message: 'Enter a positive whole baht amount',
    }),
  contributedAt: z.string().min(1),
  note: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export default function NewContributionPage() {
  const currentUser = useCurrentUser();
  const users = useMockStore((s) => s.users);
  const addContribution = useMockStore((s) => s.addContribution);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: currentUser?.id ?? '',
      amountBaht: '',
      contributedAt: new Date().toISOString().slice(0, 10),
      note: '',
    },
  });

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const memberOptions = users
    .filter((u) => !u.removedAt)
    .map((u) => ({
      value: u.id,
      label: u.id === currentUser.id ? `${u.displayName} (me)` : u.displayName,
    }));

  function onSubmit(v: Values) {
    addContribution({
      userId: isAdmin ? v.userId : currentUser!.id,
      amountCents: parseBahtInput(v.amountBaht)!,
      contributedAt: new Date(v.contributedAt).toISOString(),
      note: v.note || undefined,
      createdBy: currentUser!.id,
    });
    router.push('/contributions');
  }

  return (
    <Window title="New contribution">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {isAdmin ? (
          <Select
            label="Contributor"
            options={memberOptions}
            error={errors.userId?.message}
            {...register('userId')}
          />
        ) : (
          <p className="text-xs">
            Adding on behalf of yourself ({currentUser.displayName}).
          </p>
        )}
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
            error={errors.contributedAt?.message}
            {...register('contributedAt')}
          />
        </div>
        <TextInput label="Note (optional)" {...register('note')} />
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            Save
          </Button>
          <Button type="button" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </Window>
  );
}
