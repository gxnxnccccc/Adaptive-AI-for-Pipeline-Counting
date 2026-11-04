import { useState, type ChangeEvent, type DragEvent } from 'react'
import { Camera, Upload } from 'lucide-react'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Props = { onFiles: (files: File[]) => void; disabled?: boolean }

// Visible ring when the sr-only input inside the label has keyboard focus.
const focusRing = 'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600 has-[:focus-visible]:ring-offset-2'

export default function DropZone({ onFiles, disabled = false }: Props) {
  const [dragging, setDragging] = useState(false)

  const take = (list: FileList | File[] | null | undefined) => {
    if (!disabled && list && list.length) onFiles(Array.from(list))
  }
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    take(e.target.files)
    e.target.value = '' // allow picking the same file again after remove
  }
  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }
  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    take(e.dataTransfer?.files)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile first: on a phone the camera is the main action, so it comes first (same order in DOM and on screen). */}
      <label
        className={cn(
          'flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-100 font-semibold text-gray-700 transition-colors hover:bg-gray-200',
          focusRing,
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
        <Camera aria-hidden="true" className="size-5" />
        {t.camera.th} · {t.camera.en}
      </label>

      <div className="flex items-center gap-2 text-sm text-gray-600" aria-hidden="true">
        <span className="h-px flex-1 bg-gray-300" />
        {t.or.th} / {t.or.en}
        <span className="h-px flex-1 bg-gray-300" />
      </div>

      <label
        data-testid="dropzone"
        data-dragging={String(dragging)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center transition-colors sm:p-10',
          'hover:border-blue-500 hover:bg-blue-50',
          focusRing,
          dragging && 'border-blue-600 bg-blue-50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input type="file" accept="image/*" multiple disabled={disabled} onChange={onChange} className="sr-only" />
        <Upload aria-hidden="true" className="size-10 text-gray-400" />
        <span className="font-medium text-gray-700">{t.pick.th}</span>
        <span className="text-sm text-gray-600">{t.pick.en}</span>
      </label>
    </div>
  )
}
