import { getTranslations } from 'next-intl/server'
import { Spinner } from '@/components/y2k/spinner'

export default async function Loading() {
  const t = await getTranslations('common')
  return (
    <div className="flex justify-center items-center min-h-64">
      <Spinner label={t('loading')} />
    </div>
  )
}
