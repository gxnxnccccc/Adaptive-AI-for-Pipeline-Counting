import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, CircleAlert, Flag, LoaderCircle, Minus, Plus, RefreshCw, X } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MAX_DO, MAX_NOTES, formatVariance, parseActual, validateConfirm, variance } from '@/lib/confirm'
import { correctedCount, totals, type PhotoEdits } from '@/lib/corrections'
import type { SessionPhoto } from '@/lib/detection-session'
import { meanConfidence } from '@/lib/detection'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type ConfirmSubmit = { doNumber: string; actualAmount: number; notes: string }

type Props = {
  photos: SessionPhoto[]
  edits: Record<string, PhotoEdits>
  // Rejects with the API message on failure; the form keeps its data.
  onSubmit: (values: ConfirmSubmit) => Promise<void>
  onCancel: () => void
  // true while the submit is in flight (Result locks the viewer).
  onBusyChange: (busy: boolean) => void
}

const En = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('text-[12.5px] font-normal tracking-[.01em] text-tx-3', className)}>{children}</span>
)
const Bi = ({ p }: { p: Pair }) => (
  <span className="flex min-w-0 flex-col leading-tight">
    <span>{p.th}</span>
    <En>{p.en}</En>
  </span>
)
const chip = 'inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold'
const input =
  'w-full min-h-12 rounded-control border border-line-2 bg-surface px-3.5 py-2.5 text-base text-tx transition-colors hover:border-tx-3/60 focus:border-accent focus:shadow-[0_0_0_3px_rgb(37_99_235/0.25)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-err aria-invalid:shadow-[0_0_0_3px_rgb(185_28_28/0.2)]'

function CardTitle({ id, tag, title }: { id: string; tag: string; title: Pair }) {
  return (
    <div className="px-4 pt-4">
      <h2 id={id} className="flex flex-col text-[17px] leading-tight font-bold">
        <span className="font-mono text-xs font-medium tracking-[.08em] text-tx-3 uppercase">{tag}</span>
        <span>{title.th}</span>
        <En>{title.en}</En>
      </h2>
    </div>
  )
}

function FieldError({ id, show, text }: { id: string; show: boolean; text: Pair }) {
  if (!show) return null
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-err">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span>{text.th}</span>
        <span className="text-[12.5px] font-normal">{text.en}</span>
      </span>
    </p>
  )
}

// "03 · Count": model total -> corrected total over the kept, non-failed photos (preview .tot-grid / .kv / .per).
function Totals({ photos, edits }: { photos: SessionPhoto[]; edits: Record<string, PhotoEdits> }) {
  const tot = totals(photos, edits)
  const ok = photos.filter((p) => !p.result.error)
  const failed = photos.length - ok.length
  const mean = meanConfidence(ok.flatMap((p) => p.result.pipes))
  const pct = mean === null ? null : Math.round(mean * 100)
  const lowLeft = ok.reduce((n, p) => {
    const removed = new Set(edits[p.id]?.removed)
    return n + p.result.pipes.filter((x, i) => x.lowConfidence && !removed.has(i)).length
  }, 0)
  const cell = 'flex min-w-0 flex-col justify-between gap-1.5 rounded-control border p-3'
  const big = 'font-mono text-[34px] leading-none font-bold tabular-nums sm:text-[40px]'

  return (
    <Card role="region" aria-labelledby="h-tot" className="gap-0 py-0">
      <CardTitle id="h-tot" tag="03 · Count" title={t.totalsTitle} />
      <div className="p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
          <div className={cn(cell, 'border-line bg-bg')}>
            <Bi p={t.modelCount} />
            <b data-testid="model-total" className={big}>
              {tot.model}
            </b>
          </div>
          <ArrowRight aria-hidden="true" className="size-5 self-center text-tx-3" />
          <div className={cn(cell, 'border-accent/55 bg-linear-to-b from-accent/10 to-surface')}>
            <Bi p={t.correctedTotal} />
            <b data-testid="corrected-total" aria-live="polite" className={cn(big, 'text-accent')}>
              {tot.corrected}
            </b>
          </div>
        </div>

        <div data-testid="edit-chips" className="mt-2.5 flex min-h-[30px] flex-wrap gap-1.5">
          {tot.removed > 0 && (
            <span className={cn(chip, 'border-err/40 bg-err/12 text-err')}>
              <Minus aria-hidden="true" className="size-4" />
              <span className="font-mono">{tot.removed}</span>
              <span>{t.removedChip.th}</span>
              <span className="text-xs font-normal opacity-85">{t.removedChip.en}</span>
            </span>
          )}
          {tot.added > 0 && (
            <span className={cn(chip, 'border-ok/40 bg-ok/12 text-ok')}>
              <Plus aria-hidden="true" className="size-4" />
              <span className="font-mono">{tot.added}</span>
              <span>{t.addedChip.th}</span>
              <span className="text-xs font-normal opacity-85">{t.addedChip.en}</span>
            </span>
          )}
          {tot.removed === 0 && tot.added === 0 && <span className="text-[13px] text-tx-3">{bi(t.noCorrections)}</span>}
        </div>

        <dl className="mt-3.5 flex flex-col">
          <div className="flex items-center justify-between gap-3 border-t border-line py-2.5">
            <dt className="text-sm">
              <Bi p={t.meanConf} />
            </dt>
            <dd className="flex items-center gap-2.5 font-mono text-lg font-bold tabular-nums">
              <span aria-hidden="true" className="h-1.5 w-[72px] overflow-hidden rounded-[3px] bg-raised">
                <i className="block h-full bg-accent" style={{ width: `${pct ?? 0}%` }} />
              </span>
              <span data-testid="mean-conf">{pct === null ? '—' : `${pct}%`}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line py-2.5">
            <dt className="text-sm">
              <Bi p={t.lowConfBoxes} />
            </dt>
            <dd className="font-mono text-lg font-bold tabular-nums">{lowLeft}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line py-2.5">
            <dt className="text-sm">
              <Bi p={t.photosCounted} />
            </dt>
            <dd data-testid="photos-counted" className="flex flex-wrap items-center justify-end gap-2 font-mono text-lg font-bold tabular-nums">
              {ok.length}/{photos.length}
              {failed > 0 && (
                <span className={cn(chip, 'border-err/40 bg-err/12 font-sans text-err')}>{bi(t.nFailed(failed))}</span>
              )}
            </dd>
          </div>
        </dl>

        <ul aria-label={bi(t.perPhoto)} className="mt-1 flex flex-col gap-0.5 text-[13px]">
          {photos.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 py-[3px] text-tx-2">
              <span className="min-w-0 truncate font-mono text-tx">{p.original.name}</span>
              {p.result.error ? (
                <span className="shrink-0 text-err">— {bi(t.failedShort)}</span>
              ) : (
                <span className="shrink-0 font-mono text-tx tabular-nums">
                  {p.result.count} → {correctedCount(p.result.count, edits[p.id])}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

// Right panel of Result (ui-v2 task 8c): totals + "04 · Confirm" form, submit, cancel dialog.
export default function ConfirmPanel({ photos, edits, onSubmit, onCancel, onBusyChange }: Props) {
  const tot = totals(photos, edits)
  const [doNumber, setDoNumber] = useState('')
  // null = follow the corrected total; a string once the operator edits Actual (then it stays).
  const [actualText, setActualText] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState({ doNumber: false, notes: false })
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false) // blocks a second submit before React re-renders

  const actual = actualText ?? String(tot.corrected)
  const errors = validateConfirm({ doNumber, actual, notes })
  const valid = Object.keys(errors).length === 0
  const actualNum = parseActual(actual)
  const diff = actualNum === null ? null : variance(actualNum, tot.model)
  const missing = [
    errors.doNumber && t.doNumber,
    errors.actual && t.actualAmount,
    errors.notes && t.notes,
  ].filter((p): p is Pair => !!p)

  const step = (d: number) => setActualText(String(Math.max(0, (actualNum ?? 0) + d)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched({ doNumber: true, notes: true })
    if (!valid || actualNum === null || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      await onSubmit({ doNumber: doNumber.trim(), actualAmount: actualNum, notes: notes.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      inFlight.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }

  const showDoErr = touched.doNumber && !!errors.doNumber
  const showNotesErr = touched.notes && !!errors.notes

  return (
    <>
      <Totals photos={photos} edits={edits} />

      <Card role="region" aria-labelledby="h-cf" className="gap-0 py-0">
        <CardTitle id="h-cf" tag="04 · Confirm" title={t.confirmTitle} />
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-4">
          {error && (
            <div
              role="alert"
              data-testid="submit-error"
              className="flex items-start gap-3 rounded-control border border-err/50 bg-err/12 px-3.5 py-3 text-[15px]"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-err" />
              <p className="flex min-w-0 flex-col break-words">
                <b>{t.submitFailed.th}</b>
                <En>
                  {t.submitFailed.en}: {error}
                </En>
                <span className="mt-1">{t.correctionsKept.th}</span>
                <En>{t.correctionsKept.en}</En>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cf-do" className="flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold">
              <span>{t.doNumber.th}</span>
              <En>{t.doNumber.en}</En>
              <span aria-hidden="true" className="font-bold text-err">
                *
              </span>
            </label>
            <input
              id="cf-do"
              className={cn(input, 'font-mono')}
              value={doNumber}
              maxLength={MAX_DO}
              required
              disabled={busy}
              placeholder={t.doPlaceholder}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={showDoErr}
              aria-describedby={showDoErr ? 'cf-do-err' : undefined}
              onChange={(e) => setDoNumber(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, doNumber: true }))}
            />
            <FieldError id="cf-do-err" show={showDoErr} text={t.doRequired} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="cf-act" className="flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold">
                <span>{t.actualAmount.th}</span>
                <En>{t.actualAmount.en}</En>
                <span aria-hidden="true" className="font-bold text-err">
                  *
                </span>
              </label>
              {diff !== null &&
                (diff === 0 ? (
                  <span data-testid="variance" className={cn(chip, 'border-ok/40 bg-ok/12 text-ok')}>
                    <Check aria-hidden="true" className="size-4" />
                    <span>{t.matchesModel.th}</span>
                    <span className="text-xs font-normal opacity-85">{t.matchesModel.en}</span>
                  </span>
                ) : (
                  <span data-testid="variance" className={cn(chip, 'border-warn/40 bg-warn/12 text-warn')}>
                    <Flag aria-hidden="true" className="size-4" />
                    <span className="font-mono">{formatVariance(diff)}</span>
                    <span>{t.vsModel.th}</span>
                    <span className="text-xs font-normal opacity-85">{t.vsModel.en}</span>
                  </span>
                ))}
            </div>
            <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] gap-1.5">
              <Button
                type="button"
                variant="secondary"
                className="min-h-13 p-0"
                aria-label={bi(t.minusOne)}
                disabled={busy}
                onClick={() => step(-1)}
              >
                <Minus aria-hidden="true" className="size-5" />
              </Button>
              <input
                id="cf-act"
                className={cn(input, 'min-h-13 p-1.5 text-center font-mono text-2xl font-bold tabular-nums')}
                inputMode="numeric"
                value={actual}
                required
                disabled={busy}
                aria-invalid={!!errors.actual}
                aria-describedby={errors.actual ? 'cf-act-help cf-act-err' : 'cf-act-help'}
                onChange={(e) => setActualText(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="min-h-13 p-0"
                aria-label={bi(t.plusOne)}
                disabled={busy}
                onClick={() => step(1)}
              >
                <Plus aria-hidden="true" className="size-5" />
              </Button>
            </div>
            <p id="cf-act-help" data-testid="actual-help" className="text-[13px] text-tx-3">
              {bi(
                actualText !== null && actualNum !== null && actualNum !== tot.corrected
                  ? t.actualDiffers(tot.corrected)
                  : t.actualDefault(tot.corrected),
              )}
            </p>
            {diff !== null && diff !== 0 && (
              <p className="flex items-start gap-1.5 text-[13px] text-tx-2">
                <Flag aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warn" />
                <span className="flex flex-col leading-tight">
                  <span>{t.flagNote.th}</span>
                  <En>{t.flagNote.en}</En>
                </span>
              </p>
            )}
            <FieldError id="cf-act-err" show={!!errors.actual} text={t.actualInvalid} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="cf-notes" className="flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold">
                <span>{t.notes.th}</span>
                <En>{t.notes.en}</En>
                <span aria-hidden="true" className="font-bold text-err">
                  *
                </span>
              </label>
              <span data-testid="notes-count" className="font-mono text-[12.5px] text-tx-3">
                {notes.length}/{MAX_NOTES}
              </span>
            </div>
            <textarea
              id="cf-notes"
              className={cn(input, 'min-h-24 resize-y leading-normal')}
              value={notes}
              maxLength={MAX_NOTES}
              required
              disabled={busy}
              placeholder={t.notesPlaceholder}
              aria-invalid={showNotesErr}
              aria-describedby={showNotesErr ? 'cf-notes-err' : undefined}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, notes: true }))}
            />
            <FieldError id="cf-notes-err" show={showNotesErr} text={t.notesRequired} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Button
              type="submit"
              size="lg"
              className="w-full whitespace-normal"
              disabled={!valid || busy}
              aria-describedby={missing.length ? 'cf-sub-help' : undefined}
            >
              {busy ? (
                <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
              ) : error ? (
                <RefreshCw aria-hidden="true" className="size-5" />
              ) : (
                <Check aria-hidden="true" className="size-5" />
              )}
              {(() => {
                const label = busy ? t.submitting : error ? t.submitAgain : t.submit
                return (
                  <span className="flex flex-col leading-tight">
                    <span>{label.th}</span>
                    <span className="text-[12.5px] font-medium text-accent-ink/90">{label.en}</span>
                  </span>
                )
              })()}
            </Button>
            {missing.length > 0 && !busy && (
              <p id="cf-sub-help" className="text-center text-[13px] text-tx-3">
                {bi(t.missing(missing.map((p) => p.th).join(', '), missing.map((p) => p.en).join(', ')))}
              </p>
            )}
          </div>

          <div className="flex justify-center border-t border-line pt-3">
            <Button type="button" variant="danger" className="whitespace-normal" disabled={busy} onClick={() => setAsking(true)}>
              <X aria-hidden="true" className="size-5" />
              <span className="flex flex-col leading-tight">
                <span>{t.cancelDetection.th}</span>
                <span className="text-[12.5px] font-medium">{t.cancelDetection.en}</span>
              </span>
            </Button>
          </div>
        </form>
      </Card>

      {asking && (
        <ConfirmDialog
          title={t.cancelAsk}
          body={t.cancelBody}
          yes={t.cancelYes}
          no={t.cancelNo}
          onYes={onCancel}
          onNo={() => setAsking(false)}
        />
      )}
    </>
  )
}
