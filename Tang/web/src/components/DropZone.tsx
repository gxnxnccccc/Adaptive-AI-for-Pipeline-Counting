import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Camera, Upload } from 'lucide-react'
import CameraModal, { canUseLiveCamera } from '@/components/CameraModal'
import { buttonVariants } from '@/components/ui/button'
import { bi, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Props = { onFiles: (files: File[]) => void; disabled?: boolean }

// Visible outline when the sr-only input inside the label has keyboard focus (same as the global :focus-visible).
const focusRing = 'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent'
const camBtn = cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full flex-1 whitespace-normal')

export default function DropZone({ onFiles, disabled = false }: Props) {
  const [dragging, setDragging] = useState(false)
  const [camOpen, setCamOpen] = useState(false)
  const pickRef = useRef<HTMLInputElement>(null)
  const camLabel = (
    <>
      <Camera aria-hidden="true" className="size-5 shrink-0" />
      <span>{bi(t.takePhoto)}</span>
    </>
  )

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
      <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-3">
        {canUseLiveCamera() ? (
          <button type="button" className={camBtn} disabled={disabled} onClick={() => setCamOpen(true)}>
            {camLabel}
          </button>
        ) : (
          // No getUserMedia (e.g. phone on plain http): the native camera picker instead.
          <label className={cn(camBtn, focusRing, disabled && 'pointer-events-none opacity-45')}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              disabled={disabled}
              onChange={onChange}
              className="sr-only"
            />
            {camLabel}
          </label>
        )}
        <div aria-hidden="true" className="flex items-center gap-2 text-sm text-tx-3 min-[640px]:hidden">
          <span className="flex-1 border-t border-line-2" />
          {bi(t.orWord)}
          <span className="flex-1 border-t border-line-2" />
        </div>
      </div>

      <label
        data-testid="dropzone"
        data-dragging={String(dragging)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-control border-2 border-dashed border-line-2 px-4 py-8 text-center text-tx-2 transition-colors',
          'hover:border-accent hover:bg-accent/10',
          focusRing,
          dragging && 'border-accent bg-accent/10',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input ref={pickRef} type="file" accept="image/*" multiple disabled={disabled} onChange={onChange} className="sr-only" />
        <Upload aria-hidden="true" className="size-11 text-tx-3" />
        <span className="mt-1.5">{t.tapToChoose.th}</span>
        <span className="text-sm text-tx-3">{t.tapToChoose.en}</span>
      </label>

      {camOpen && (
        <CameraModal
          onClose={() => setCamOpen(false)}
          onShots={(files) => {
            setCamOpen(false)
            take(files)
          }}
          onPickInstead={() => {
            setCamOpen(false)
            pickRef.current?.click()
          }}
        />
      )}
    </div>
  )
}
