'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Window } from '@/components/y2k/window'
import { Button } from '@/components/y2k/button'
import { TextInput } from '@/components/y2k/text-input'
import { Select } from '@/components/y2k/select'
import { createExpense, getSignedReceiptUploadUrl } from '@/lib/actions/expenses'
import { expenseFormSchema, type ExpenseFormValues, payerOptions, CATEGORY_OPTIONS } from '@/lib/expense-form'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import type { User } from '@/lib/types'

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const
type Mime = (typeof ACCEPTED_MIME)[number]
const MAX_BYTES = 5 * 1024 * 1024

const EXT_BY_MIME: Record<Mime, 'jpg' | 'png' | 'webp' | 'heic'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export default function NewExpenseForm({ currentUser, users }: { currentUser: User; users: User[] }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const expenseId = useMemo(() => crypto.randomUUID(), [])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

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

  function onPickReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    setReceiptError(null)
    const file = e.target.files?.[0]
    if (!file) { setReceiptFile(null); return }
    if (!ACCEPTED_MIME.includes(file.type as Mime)) {
      setReceiptError('Only JPEG, PNG, WebP, or HEIC images are accepted')
      setReceiptFile(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setReceiptError('Receipt must be 5 MB or smaller')
      setReceiptFile(null)
      return
    }
    setReceiptFile(file)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    if (file.type === 'image/heic') {
      previewUrlRef.current = null
      setPreviewUrl(null)
    } else {
      const url = URL.createObjectURL(file)
      previewUrlRef.current = url
      setPreviewUrl(url)
    }
  }

  async function onSubmit(v: ExpenseFormValues) {
    setServerError(null)

    let receiptStoragePath: string | undefined
    let receiptMimeType: Mime | undefined

    if (receiptFile) {
      const mimeType = receiptFile.type as Mime
      const ext = EXT_BY_MIME[mimeType]

      const upload = await getSignedReceiptUploadUrl({ expenseId, mimeType, ext })
      if (!upload.ok) { setServerError(upload.error); return }

      const supabase = createSupabaseBrowserClient()
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .uploadToSignedUrl(upload.storagePath, upload.token, receiptFile, { contentType: mimeType })
      if (uploadError) { setServerError(`Upload failed: ${uploadError.message}`); return }

      receiptStoragePath = upload.storagePath
      receiptMimeType = mimeType
    }

    const result = await createExpense({
      ...v,
      id: expenseId,
      receiptStoragePath,
      receiptMimeType,
    })
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

        <div className="flex flex-col gap-1">
          <label className="font-bold">Receipt (optional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={onPickReceipt}
            className="bevel-in bg-white px-2 py-1 font-sans text-[13px]"
          />
          {receiptError ? <span className="text-y2k-magenta text-sm">{receiptError}</span> : null}
          {receiptFile && !previewUrl ? (
            <span className="text-y2k-blue text-sm">{receiptFile.name} (HEIC — preview not supported)</span>
          ) : null}
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Receipt preview" className="bevel-in mt-2 max-h-64 w-auto object-contain" />
          ) : null}
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
