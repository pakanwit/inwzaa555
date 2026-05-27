'use client'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Select } from '@/components/y2k/select'
import { createContribution, getSignedSlipUploadUrl } from '@/lib/actions/contributions'
import { createMember } from '@/lib/actions/members'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import { parseBahtInput } from '@/lib/money'
import type { User } from '@/lib/types'

const ADD_NEW_MEMBER = '__add_new_member__'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const
type Mime = (typeof ACCEPTED_MIME)[number]
const EXT_BY_MIME: Record<Mime, 'jpg' | 'png' | 'webp' | 'heic'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

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
  const t = useTranslations('contributions')
  const tCommon = useTranslations('common')
  const [serverError, setServerError] = useState<string | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipError, setSlipError] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const contributionId = useMemo(() => crypto.randomUUID(), [])

  // Local roster so newly-created Members appear in the dropdown without a full refresh.
  const [roster, setRoster] = useState<User[]>(users)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [addingMember, setAddingMember] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: currentUser.id,
      amountBaht: '',
      contributedAt: new Date().toISOString().slice(0, 10),
      note: '',
    },
  })

  const memberOptions = [
    ...roster.map((u) => ({
      value: u.id,
      label: u.id === currentUser.id ? t('meSuffix', { name: u.displayName }) : u.displayName,
    })),
    { value: ADD_NEW_MEMBER, label: t('addNewMember') },
  ]

  function onContributorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_NEW_MEMBER) {
      setShowAddMember(true)
      // Revert the visible selection so the form doesn't hold the sentinel value.
      setValue('userId', currentUser.id)
    }
  }

  async function onAddMember() {
    setAddMemberError(null)
    if (!newName.trim()) { setAddMemberError(t('nameRequired')); return }
    setAddingMember(true)
    const result = await createMember({ displayName: newName, email: newEmail || undefined })
    setAddingMember(false)
    if (!result.ok) { setAddMemberError(result.error); return }
    setRoster((prev) => [...prev, result.member])
    setValue('userId', result.member.id, { shouldValidate: true })
    setShowAddMember(false)
    setNewName('')
    setNewEmail('')
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlipError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) { setSlipFile(null); setPreviewUrl(null); return }
    if (!ACCEPTED_MIME.includes(file.type as Mime)) {
      setSlipError(tCommon('imageOnlyAccepted'))
      setSlipFile(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setSlipError(tCommon('imageTooLarge'))
      setSlipFile(null)
      return
    }
    setSlipFile(file)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    // HEIC won't render inline in most browsers — skip preview for it
    if (file.type === 'image/heic') {
      previewUrlRef.current = null
      setPreviewUrl(null)
    } else {
      const url = URL.createObjectURL(file)
      previewUrlRef.current = url
      setPreviewUrl(url)
    }
  }

  async function onSubmit(v: Values) {
    setServerError(null)
    if (!slipFile) { setSlipError('Slip image is required'); return }

    const mimeType = slipFile.type as Mime
    const ext = EXT_BY_MIME[mimeType]

    const upload = await getSignedSlipUploadUrl({ contributionId, mimeType, ext })
    if (!upload.ok) { setServerError(upload.error); return }

    const supabase = createSupabaseBrowserClient()
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .uploadToSignedUrl(upload.storagePath, upload.token, slipFile, { contentType: mimeType })
    if (uploadError) { setServerError(tCommon('uploadFailed', { message: uploadError.message })); return }

    const result = await createContribution({
      ...v,
      id: contributionId,
      slipStoragePath: upload.storagePath,
      slipMimeType: mimeType,
    })
    if (result.ok) { router.push('/contributions'); router.refresh() }
    else setServerError(result.error)
  }

  return (
    <Window title="New contribution">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Select
          label={t('fieldContributor')}
          options={memberOptions}
          error={errors.userId?.message}
          {...register('userId', { onChange: onContributorChange })}
        />
        {showAddMember ? (
          <div className="bevel-in bg-y2k-chrome-100 flex flex-col gap-2 p-3">
            <strong className="text-sm">{t('addNewMemberTitle')}</strong>
            <TextInput
              label={t('fieldDisplayName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
            <TextInput
              label={`${t('fieldEmail')} ${tCommon('optional')}`}
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
            />
            {addMemberError ? <span className="text-y2k-magenta text-sm">{addMemberError}</span> : null}
            <div className="flex gap-2">
              <Button type="button" variant="primary" onClick={onAddMember} disabled={addingMember}>
                {addingMember ? tCommon('adding') : tCommon('add')}
              </Button>
              <Button
                type="button"
                onClick={() => { setShowAddMember(false); setAddMemberError(null) }}
              >
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label={t('fieldAmount')} inputMode="numeric" error={errors.amountBaht?.message} {...register('amountBaht')} />
          <TextInput label={t('fieldDate')} type="date" error={errors.contributedAt?.message} {...register('contributedAt')} />
        </div>
        <TextInput label={`${t('fieldNote')} ${tCommon('optional')}`} {...register('note')} />
        <div className="flex flex-col gap-1">
          <label className="font-bold">Bank slip (required)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={onFileChange}
            className="bevel-in bg-white px-2 py-1 font-sans text-[13px]"
          />
          {slipError ? <span className="text-y2k-magenta text-sm">{slipError}</span> : null}
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Slip preview" className="bevel-in mt-2 max-h-64 w-auto object-contain" />
          ) : null}
        </div>
        {serverError ? <p className="text-y2k-magenta text-sm">{serverError}</p> : null}
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={isSubmitting}>{tCommon('save')}</Button>
          <Button type="button" onClick={() => router.back()}>{tCommon('cancel')}</Button>
        </div>
      </form>
    </Window>
  )
}
