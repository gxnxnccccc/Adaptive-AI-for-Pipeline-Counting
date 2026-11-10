import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Camera, Images, Upload } from 'lucide-react'
import CameraModal, { canUseLiveCamera } from '@/components/CameraModal'
import { Button, buttonVariants } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Props = { onFiles: (files: File[]) => void; disabled?: boolean }

// Visible cyan outline when the sr-only input inside the label has keyboard focus (same as the global :focus-visible).
const focusRing = 'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent'
const En = ({ children }: { children: string }) => <span className="text-[12.5px] font-normal text-tx-3">{children}</span>

export default function DropZone({ onFiles, disabled = false }: Props) {
  const [dragging, setDragging] = useState(false)
  const [camOpen, setCamOpen] = useState(false)
  const pickRef = useRef<HTMLInputElement>(null)
  const camLabel = (
    <>
      <Camera aria-hidden="true" className="size-5 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span>{t.openCamera.th}</span>
        <En>{t.openCamera.en}</En>
      </span>
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
    <div className="flex flex-col gap-3.5">
      <label
        data-testid="dropzone"
        data-dragging={String(dragging)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-dashed border-line-2 bg-bg/50 px-4 py-6 text-center font-semibold transition-colors desk:py-11',
          'hover:border-accent hover:bg-accent/12',
          focusRing,
          dragging && 'border-accent bg-accent/12',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input ref={pickRef} type="file" accept="image/*" multiple disabled={disabled} onChange={onChange} className="sr-only" />
        <span className="mb-1.5 grid size-14 place-items-center rounded-full border border-accent/35 bg-accent/12 text-accent">
          <Upload aria-hidden="true" className="size-7" />
        </span>
        <span>{t.dropHint.th}</span>
        <En>{t.dropHint.en}</En>
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        {canUseLiveCamera() ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="whitespace-normal"
            disabled={disabled}
            onClick={() => setCamOpen(true)}
          >
            {camLabel}
          </Button>
        ) : (
          // No getUserMedia (e.g. phone on plain http): the native camera picker instead.
          <label
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'lg' }),
              'whitespace-normal',
              focusRing,
              disabled && 'pointer-events-none opacity-45',
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
            {camLabel}
          </label>
        )}
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="whitespace-normal"
          disabled={disabled}
          onClick={() => pickRef.current?.click()}
        >
          <Images aria-hidden="true" className="size-5 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span>{t.choosePhotos.th}</span>
            <En>{t.choosePhotos.en}</En>
          </span>
        </Button>
      </div>

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
