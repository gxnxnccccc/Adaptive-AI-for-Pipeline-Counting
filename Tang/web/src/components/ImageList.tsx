import { CircleAlert, CircleCheck, Clock, LoaderCircle, Moon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DetectedImage } from '@/lib/detection'
import { bi, t } from '@/lib/i18n'

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed'

export type UploadItem = {
  id: string
  file: File
  previewUrl: string
  status: UploadStatus
  result?: DetectedImage
  error?: string
}

type Props = {
  items: UploadItem[]
  onRemove: (id: string) => void
  disabled?: boolean
}

function Status({ item }: { item: UploadItem }) {
  switch (item.status) {
    case 'queued':
      return (
        <span className="flex items-center gap-1.5 text-gray-600">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          {bi(t.queued)}
        </span>
      )
    case 'uploading':
      return (
        <span className="flex items-center gap-1.5 text-blue-700">
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
          {bi(t.uploading)}
        </span>
      )
    case 'done':
      return (
        <span className="flex items-center gap-1.5 font-semibold text-green-700">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {bi(t.count(item.result?.count ?? 0))}
        </span>
      )
    case 'failed':
      return (
        <span className="flex flex-col gap-0.5 text-red-700">
          <span className="flex items-center gap-1.5 font-semibold">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {bi(t.failed)}
          </span>
          {item.error && <span className="break-words text-sm">{item.error}</span>}
        </span>
      )
  }
}

export default function ImageList({ items, onRemove, disabled = false }: Props) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-col gap-3" aria-live="polite">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <img
            src={item.previewUrl}
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-lg bg-gray-100 object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-medium text-gray-800" title={item.file.name}>
              {item.file.name}
            </span>
            <span className="text-sm text-gray-600">{(item.file.size / (1024 * 1024)).toFixed(1)} MB</span>
            <Status item={item} />
            {item.result?.brightness === 'dark' && (
              <span className="flex w-fit items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-sm text-amber-900">
                <Moon aria-hidden="true" className="size-4 shrink-0" />
                {bi(t.dark)}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-gray-600"
            aria-label={bi(t.remove(item.file.name))}
            disabled={disabled || item.status === 'uploading'}
            onClick={() => onRemove(item.id)}
          >
            <X aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
