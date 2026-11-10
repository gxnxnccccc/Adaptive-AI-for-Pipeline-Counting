import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Check, CircleAlert, CircleCheck, Info, LoaderCircle, RefreshCw, ScanLine } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import DropZone from '@/components/DropZone'
import PhotoRow, { warnings, type QueueRow } from '@/components/PhotoRow'
import Toast from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { uploadImages } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatBytes } from '@/lib/compress'
import { toDetectedImages } from '@/lib/detection'
import { useDetectionSession, type SessionPhoto } from '@/lib/detection-session'
import { bi, t, type Pair } from '@/lib/i18n'
import { useShell } from '@/lib/shell-context'
import { preparePhoto, type Prepared } from '@/lib/prepare'

// Mirrors api/app/config.py (max_files_per_request, max_file_bytes). Change both together.
const MAX_FILES = 10
const MAX_FILE_MB = 15
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
// Done banner shows this long before Result opens on its own (Review skips the wait).
export const REVIEW_DELAY_MS = 1_500

// idle -> running (one POST /api/counts for all ready photos) -> done (navigate) | error (photos kept, retry)
type Phase = 'idle' | 'running' | 'done' | 'error'
type Summary = { counted: number; sent: number; pipes: number }

const En = ({ children }: { children: ReactNode }) => (
  <span className="text-[12.5px] font-normal tracking-[.01em] text-tx-3">{children}</span>
)
const Tag = ({ children }: { children: string }) => (
  <span className="font-mono text-xs font-medium tracking-[.08em] text-tx-3 uppercase">{children}</span>
)
const Spin = () => <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />

type Ready = QueueRow & { prep: Prepared }
const isReady = (r: QueueRow): r is Ready => r.status === 'ready' && !!r.prep
const isPreparing = (r: QueueRow) => r.status === 'queued' || r.status === 'checking' || r.status === 'compressing'

export default function Processing() {
  const { operator } = useAuth()
  const { start, lastSavedDo, setLastSavedDo, batchId, photos: sessionPhotos } = useDetectionSession()
  const navigate = useNavigate()
  const { recheckApi } = useShell()
  // Both stable, so the toast's auto-hide timer is not restarted by re-renders.
  const closeToast = useCallback(() => setLastSavedDo(null), [setLastSavedDo])
  const toast = useMemo(() => (lastSavedDo ? t.savedDo(lastSavedDo) : null), [lastSavedDo])

  const [rows, setRows] = useState<QueueRow[]>([])
  const [notices, setNotices] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  // Detect while an unsent review exists: ask first (a new detection replaces it and its edits).
  const [askNew, setAskNew] = useState(false)

  // id -> thumbnail URL of every row still in the queue. Revoked on remove / unmount.
  // A missing id means the row is gone, so its turn in the prepare chain is skipped.
  const live = useRef(new Map<string, string>())
  // Photos are checked + compressed one at a time, in the order they were added.
  const chain = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    const m = live.current
    return () => {
      m.forEach((u) => URL.revokeObjectURL(u))
      m.clear()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'done') return
    const id = setTimeout(() => navigate('/result'), REVIEW_DELAY_MS)
    return () => clearTimeout(id)
  }, [phase, navigate])

  const patch = (id: string, p: Partial<QueueRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)))

  function addFiles(files: File[]) {
    const msgs: string[] = []
    const ok: File[] = []
    for (const f of files) {
      // `accept` is not enforced on drag and drop, so check here too.
      if (!f.type.startsWith('image/')) msgs.push(bi(t.notImage(f.name)))
      else if (f.size > MAX_FILE_BYTES) msgs.push(bi(t.tooBig(f.name, MAX_FILE_MB)))
      else ok.push(f)
    }
    const room = Math.max(MAX_FILES - rows.length, 0)
    if (ok.length > room) msgs.push(bi(t.tooMany(MAX_FILES)))

    const added: QueueRow[] = ok.slice(0, room).map((original) => {
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(original)
      live.current.set(id, previewUrl)
      return { id, original, previewUrl, status: 'queued' }
    })
    setRows((prev) => [...prev, ...added])
    setNotices(msgs)

    for (const r of added) {
      chain.current = chain.current.then(async () => {
        if (!live.current.has(r.id)) return
        try {
          const prep = await preparePhoto(r.original, (step) => patch(r.id, { status: step }))
          patch(r.id, { status: 'ready', prep })
        } catch {
          // Decode error: shown failed, never uploaded.
          patch(r.id, { status: 'failed', error: bi(t.cantRead) })
        }
      })
    }
  }

  function remove(id: string) {
    const url = live.current.get(id)
    if (url) URL.revokeObjectURL(url)
    live.current.delete(id)
    setRows((prev) => prev.filter((r) => r.id !== id))
    setNotices([])
  }

  const busy = phase === 'running' || phase === 'done'
  const ready = rows.filter(isReady)
  const preparing = rows.some(isPreparing)

  // A detection the operator has not submitted or cancelled yet (Back to processing keeps it).
  const hasSession = batchId !== null && sessionPhotos.length > 0 && !busy

  function onDetect() {
    if (hasSession) setAskNew(true)
    else void detect()
  }

  async function detect() {
    setAskNew(false)
    const batch = rows.filter(isReady)
    if (batch.length === 0 || busy) return
    setPhase('running')
    setError(null)
    try {
      const resp = await uploadImages(
        batch.map((r) => r.prep.upload),
        operator ?? undefined,
      )
      const results = toDetectedImages(resp)
      // The API answers in the same order the files were sent.
      const byId = new Map(batch.map((r, n) => [r.id, results[n]]))
      setRows((prev) =>
        prev.map((r): QueueRow => {
          if (!byId.has(r.id)) return r
          const res = byId.get(r.id)
          if (!res) return { ...r, status: 'failed', error: bi(t.noResult) }
          return res.error ? { ...r, status: 'failed', error: res.error, result: res } : { ...r, status: 'done', result: res }
        }),
      )
      const photos: SessionPhoto[] = batch.flatMap((r, n) =>
        results[n]
          ? [
              {
                id: r.id,
                original: r.original,
                upload: r.prep.upload,
                originalBytes: r.prep.originalBytes,
                uploadBytes: r.prep.uploadBytes,
                width: r.prep.width,
                height: r.prep.height,
                quality: r.prep.quality,
                result: results[n],
              },
            ]
          : [],
      )
      const ok = photos.filter((p) => !p.result.error)
      setSummary({ counted: ok.length, sent: batch.length, pipes: ok.reduce((s, p) => s + p.result.count, 0) })
      start(resp.batch_id, photos)
      setPhase('done')
    } catch (e) {
      // Rows stay ready, so Try again re-sends the same compressed files.
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
      recheckApi() // update the API chip now instead of at the next poll
    }
  }

  // Upload-size bar: every photo that will be sent (decode failures left out).
  const sized = rows.filter((r) => r.status !== 'failed' || r.prep)
  const origTotal = sized.reduce((s, r) => s + r.original.size, 0)
  const upTotal = sized.reduce((s, r) => s + (r.prep?.uploadBytes ?? 0), 0)
  const sizePct = origTotal ? Math.round((1 - upTotal / origTotal) * 100) : 0
  const warnCount = ready.filter((r) => warnings(r.prep.quality).length > 0).length

  let cta: { label: Pair; icon: ReactNode; disabled: boolean; help?: Pair }
  if (phase === 'running') cta = { label: t.stRunning, icon: <Spin />, disabled: true, help: t.keepOpen }
  else if (phase === 'done') cta = { label: t.openingReview, icon: <Spin />, disabled: true }
  else if (preparing) cta = { label: t.preparing, icon: <Spin />, disabled: true, help: t.preparingHelp }
  else if (ready.length === 0) cta = { label: t.detect, icon: <ScanLine aria-hidden="true" />, disabled: true, help: t.addOne }
  else if (phase === 'error') cta = { label: t.tryAgain, icon: <RefreshCw aria-hidden="true" />, disabled: false }
  else
    cta = {
      label: t.detectN(ready.length),
      icon: <ScanLine aria-hidden="true" />,
      disabled: false,
      help: warnCount ? t.warnHelp(warnCount) : undefined,
    }

  const limits = t.limitsNote(MAX_FILES, MAX_FILE_MB)

  return (
    <div className="flex flex-col gap-4 desk:gap-5">
      <Toast message={toast} onClose={closeToast} />

      {/* Screen readers hear only finished photos (done / failed), not every checking / compressing step. */}
      <div aria-live="polite" data-testid="queue-announce" className="sr-only">
        {rows
          .filter((r) => r.status === 'done' || r.status === 'failed')
          .map((r) => (
            <p key={r.id}>
              {r.original.name}: {bi(r.status === 'done' && r.result ? t.count(r.result.count) : t.failed)}
            </p>
          ))}
      </div>

      {hasSession && (
        <div
          role="region"
          aria-label={bi(t.sessionOpen)}
          data-testid="session-banner"
          className="flex flex-wrap items-center gap-3 rounded-control border border-accent/45 bg-accent/12 px-3.5 py-3 text-[15px]"
        >
          <Info aria-hidden="true" className="size-5 shrink-0 text-accent" />
          <p className="flex min-w-[min(100%,14rem)] flex-1 flex-col">
            <b>{t.sessionOpen.th}</b>
            <En>{t.sessionOpen.en}</En>
          </p>
          <Button asChild className="whitespace-normal">
            <Link to="/result">
              <span>{t.backToReview.th}</span>
              <span className="text-[12.5px] font-medium text-accent-ink/75">{t.backToReview.en}</span>
              <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
          </Button>
        </div>
      )}

      {askNew && (
        <ConfirmDialog
          title={t.newDetectAsk}
          body={t.newDetectBody}
          yes={t.newDetectYes}
          no={t.newDetectNo}
          onYes={() => void detect()}
          onNo={() => setAskNew(false)}
        />
      )}

      {error && (
        <div
          role="alert"
          data-testid="upload-error"
          className="flex items-start gap-3 rounded-control border border-err/50 bg-err/12 px-3.5 py-3 text-[15px]"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-err" />
          <p className="flex flex-col">
            <b>{t.uploadFailed.th}</b>
            <En>{error}</En>
            <span className="mt-1">{t.photosKept.th}</span>
            <En>{t.photosKept.en}</En>
          </p>
        </div>
      )}

      {phase === 'done' && summary && (
        <div
          role="status"
          data-testid="done-banner"
          className="flex flex-wrap items-start gap-3 rounded-control border border-ok/50 bg-ok/12 px-3.5 py-3 text-[15px]"
        >
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
          {(() => {
            const title = t.doneTitle(summary.counted, summary.sent, summary.pipes)
            const failed = summary.sent - summary.counted
            return (
              <p className="flex min-w-0 flex-1 flex-col">
                <b>{title.th}</b>
                <En>{title.en}</En>
                {failed > 0 && <span className="text-sm text-tx-2">{bi(t.doneFailed(failed))}</span>}
              </p>
            )
          })()}
          <Button onClick={() => navigate('/result')}>
            <span>{t.review.th}</span>
            <span className="text-[12.5px] font-medium text-accent-ink/75">{t.review.en}</span>
            <ArrowRight aria-hidden="true" className="size-5" />
          </Button>
          <div aria-hidden="true" className="ml-8 h-1.5 basis-full overflow-hidden rounded-[3px] bg-raised">
            <i
              className="block h-full origin-left animate-fill rounded-[3px] bg-accent motion-reduce:animate-none"
              style={{ animationDuration: `${REVIEW_DELAY_MS}ms` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 desk:gap-5 min-[1100px]:grid min-[1100px]:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)] min-[1100px]:items-start">
        <Card role="region" aria-labelledby="h-cap" className="gap-0 py-0">
          <div className="px-4 pt-4">
            <h2 id="h-cap" className="flex flex-col text-[17px] leading-tight font-bold">
              <Tag>01 · Input</Tag>
              <span>{t.step1.th}</span>
              <En>{t.step1.en}</En>
            </h2>
          </div>
          <div className="flex flex-col gap-3.5 p-4">
            <DropZone onFiles={addFiles} disabled={busy || rows.length >= MAX_FILES} />
            <p className="flex items-start gap-2 text-sm text-tx-2">
              <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-accent" />
              <span className="flex flex-col leading-tight">
                <span>{limits.th}</span>
                <En>{limits.en}</En>
              </span>
            </p>
            {notices.length > 0 && (
              <div role="alert" className="flex items-start gap-3 rounded-control border border-err/50 bg-err/12 px-3.5 py-3 text-sm">
                <CircleAlert aria-hidden="true" className="mt-px size-5 shrink-0 text-err" />
                <div className="flex flex-col gap-1">
                  {notices.map((m) => (
                    <p key={m}>{m}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 border-t border-line pt-3.5">
              <Tag>{bi(t.tips)}</Tag>
              <ul className="flex flex-col gap-1.5">
                {t.tipList.map((p) => (
                  <li key={p.en} className="flex items-start gap-2 text-sm">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span className="flex flex-col leading-tight">
                      <span>{p.th}</span>
                      <En>{p.en}</En>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card role="region" aria-labelledby="h-q" className="gap-0 py-0">
          <div className="flex items-start gap-3 px-4 pt-4">
            <h2 id="h-q" className="flex flex-col text-[17px] leading-tight font-bold">
              <Tag>02 · Queue</Tag>
              <span>{t.queueTitle.th}</span>
              <En>{t.queueTitle.en}</En>
            </h2>
            <span data-testid="queue-count" className="ml-auto pt-[18px] font-mono text-[15px] text-tx-2 tabular-nums">
              <b className="text-xl text-tx">{rows.length}</b>/{MAX_FILES}
            </span>
          </div>

          <div className="p-4">
            {rows.length > 0 ? (
              <>
                <p
                  data-testid="upload-size"
                  className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-control border border-line bg-bg px-3 py-2.5 text-sm"
                >
                  <Tag>{bi(t.uploadSize)}</Tag>{' '}
                  <span className="font-mono text-tx tabular-nums">
                    {formatBytes(origTotal)} → {preparing ? '…' : formatBytes(upTotal)}
                  </span>{' '}
                  {!preparing && sizePct > 0 && <span className="font-mono text-ok tabular-nums">−{sizePct}%</span>}
                </p>
                <ul data-testid="queue-rows" className="flex flex-col gap-2.5">
                  {rows.map((r) => (
                    <PhotoRow key={r.id} row={r} running={phase === 'running'} removeDisabled={busy} onRemove={remove} />
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 px-4 py-9 text-center text-tx-2">
                <svg viewBox="0 0 120 72" aria-hidden="true" className="mb-1.5 h-[72px] w-[120px] fill-none stroke-2 [stroke-dasharray:4_4]">
                  <circle cx="38" cy="46" r="18" className="stroke-line-2" />
                  <circle cx="82" cy="46" r="18" className="stroke-line-2" />
                  <circle cx="60" cy="22" r="18" className="stroke-accent" />
                </svg>
                <b className="text-tx">{t.queueEmpty.th}</b>
                <En>{t.queueEmpty.en}</En>
                <span className="text-sm">{t.queueEmptyHint.th}</span>
                <En>{t.queueEmptyHint.en}</En>
              </div>
            )}
          </div>

          {/* Phone: sticks above the 60 px tab bar. Desktop: sticks to the bottom of the viewport. */}
          <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-[5] flex flex-col gap-1.5 rounded-b-card border-t border-line bg-surface px-4 pt-3 pb-4 desk:bottom-0">
            <Button data-testid="detect-cta" size="lg" className="w-full whitespace-normal" disabled={cta.disabled} onClick={onDetect}>
              {cta.icon}
              <span className="flex flex-wrap items-baseline justify-center gap-x-1.5">
                <span>{cta.label.th}</span>
                <span className="text-[12.5px] font-medium text-accent-ink/75">{cta.label.en}</span>
              </span>
            </Button>
            {cta.help && <p className="text-center text-[13px] text-tx-3">{bi(cta.help)}</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
