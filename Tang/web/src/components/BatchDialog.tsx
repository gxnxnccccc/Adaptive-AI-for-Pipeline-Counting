import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RecordRow } from '@/lib/api'
import { formatVariance } from '@/lib/confirm'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Props = { r: RecordRow; status: ReactNode; onClose: () => void }

const DASH = '—'
const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : DASH

function Field({ label, children, mono, wide }: { label: Pair; children: ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', wide && 'col-span-2')}>
      <dt className="text-xs text-tx-3">{bi(label)}</dt>
      <dd className={cn('m-0 text-[15px] font-semibold break-words', mono && 'font-mono tabular-nums')}>{children}</dd>
    </div>
  )
}

// Read-only details of one batch from Recent 10 (Dashboard row click). Uses the row already loaded: no extra request.
// Esc / Close / backdrop click closes, Tab stays inside, focus goes back to the row's button.
export default function BatchDialog({ r, status, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => opener?.focus?.()
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !boxRef.current) return
    const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const doText = r.doNumber ?? bi(t.notConfirmedYet)
  return createPortal(
    <div
      data-testid="batch-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault()
          onClose()
        }
      }}
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-tx/40 p-4 backdrop-blur-[3px]"
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-title"
        onKeyDown={onKeyDown}
        className="w-full max-w-[480px] rounded-card border border-line-2 bg-surface shadow-pop"
      >
        <div className="flex items-start justify-between gap-3 px-[18px] pt-[18px]">
          <h2 id="bd-title" className="flex min-w-0 flex-col leading-snug">
            <span className="text-xs font-normal text-tx-3">{bi(t.batchDetails)}</span>
            <span className={cn('text-xl font-bold break-words', r.doNumber && 'font-mono')}>{doText}</span>
          </h2>
          <Button ref={closeRef} variant="ghost" size="icon" aria-label={bi(t.close)} onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <div className="px-[18px] pt-2">{status}</div>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 px-[18px] py-4">
          <Field label={t.colModel} mono>
            {r.modelTotal}
          </Field>
          <Field label={t.colActual} mono>
            {r.actualAmount ?? DASH}
          </Field>
          <Field label={t.varianceLabel} mono>
            {r.variance === null ? DASH : formatVariance(r.variance)}
          </Field>
          <Field label={t.colPhotos} mono>
            {r.imageCount}
          </Field>
          <Field label={t.colOperator} mono>
            {r.operatorId}
          </Field>
          <Field label={t.createdAt} mono>
            {stamp(r.createdAt)}
          </Field>
          <Field label={t.confirmedAt} mono>
            {stamp(r.confirmedAt)}
          </Field>
          <Field label={t.notes} wide>
            <span className="font-normal whitespace-pre-wrap">{r.notes || DASH}</span>
          </Field>
          <Field label={t.batchId} mono wide>
            <span className="text-xs font-normal text-tx-2">{r.batchId}</span>
          </Field>
        </dl>
      </div>
    </div>,
    document.body,
  )
}
