'use client'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Select } from '@/components/y2k/select'
import { createContribution, getSignedSlipUploadUrl } from '@/lib/actions/contributions'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import { parseBahtInput } from '@/lib/money'
import type { User } from '@/lib/types'

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
  const [serverError, setServerError] = useState<string | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipError, setSlipError] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const contributionId = useMemo(() => crypto.randomUUID(), [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: currentUser.id,
      amountBaht: '',
      contributedAt: new Date().toISOString().slice(0, 10),
      note: '',
    },
  })

  const memberOptions = users.map((u) => ({
    value: u.id,
    label: u.id === currentUser.id ? `${u.displayName} (me)` : u.displayName,
  }))

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlipError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) { setSlipFile(null); setPreviewUrl(null); return }
    if (!ACCEPTED_MIME.includes(file.type as Mime)) {
      setSlipError('Only JPEG, PNG, WebP, or HEIC images are accepted')
      setSlipFile(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setSlipError('Slip must be 5 MB or smaller')
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
    if (uploadError) { setServerError(`Upload failed: ${uploadError.message}`); return }

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
        <Select label="Contributor" options={memberOptions} error={errors.userId?.message} {...register('userId')} />
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Amount (THB)" inputMode="numeric" error={errors.amountBaht?.message} {...register('amountBaht')} />
          <TextInput label="Date" type="date" error={errors.contributedAt?.message} {...register('contributedAt')} />
        </div>
        <TextInput label="Note (optional)" {...register('note')} />
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
          <Button variant="primary" type="submit" disabled={isSubmitting}>Save</Button>
          <Button type="button" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </Window>
  )
}
