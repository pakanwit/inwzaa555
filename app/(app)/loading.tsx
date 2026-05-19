import { Spinner } from '@/components/y2k/spinner'

export default function Loading() {
  return (
    <div className="flex justify-center items-center min-h-64">
      <Spinner label="Loading…" />
    </div>
  )
}
