import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, CircleAlert, CircleCheck, Info, LoaderCircle, RefreshCw, Upload } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import DropZone from '@/components/DropZone'
import PhotoRow, { warnings, type QueueRow } from '@/components/PhotoRow'
import Toast from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { uploadImages } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { toDetectedImages } from '@/lib/detection'
import { useDetectionSession, type SessionPhoto } from '@/lib/detection-session'
import { bi, t, type Pair } from '@/lib/i18n'
import { useShell } from '@/lib/shell-context'
import { preparePhoto, type Prepared } from '@/lib/prepare'

// Mirrors api/app/config.py (max_files_per_request, max_file_bytes). Change both together.
const MAX_FILES = 10
const MAX_FILE_MB = 15
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

// idle -> running (one POST /api/counts for all ready photos) -> done (Review button -> /result) | error (photos kept, retry)
type Phase = 'idle' | 'running' | 'done' | 'error'
type Summary = { counted: number; sent: number; pipes: number }

const En = ({ children }: { children: ReactNode }) => (
  <span className="text-[12.5px] font-normal tracking-[.01em] text-tx-3">{children}</span>
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

  const warnCount = ready.filter((r) => warnings(r.prep.quality).length > 0).length

  let cta: { label: Pair; icon: ReactNode; disabled: boolean; help?: Pair; onClick: () => void }
  if (phase === 'running') cta = { label: t.uploadingAll, icon: <Spin />, disabled: true, help: t.keepOpen, onClick: onDetect }
  else if (phase === 'done')
    cta = { label: t.reviewResults, icon: <ArrowRight aria-hidden="true" className="size-5" />, disabled: false, onClick: () => navigate('/result') }
  else if (preparing) cta = { label: t.preparing, icon: <Spin />, disabled: true, help: t.preparingHelp, onClick: onDetect }
  else if (ready.length === 0) cta = { label: t.uploadN(0), icon: <Upload aria-hidden="true" className="size-5" />, disabled: true, onClick: onDetect }
  else if (phase === 'error') cta = { label: t.tryAgain, icon: <RefreshCw aria-hidden="true" className="size-5" />, disabled: false, onClick: onDetect }
  else
    cta = {
      label: t.uploadN(ready.length),
      icon: <Upload aria-hidden="true" className="size-5" />,
      disabled: false,
      help: warnCount ? t.warnHelp(warnCount) : undefined,
      onClick: onDetect,
    }

  const limit = t.limitLine(rows.length, MAX_FILES, MAX_FILE_MB)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
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
              <span className="text-[12.5px] font-medium text-accent-ink/90">{t.backToReview.en}</span>
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
        </div>
      )}

      <Card role="region" aria-labelledby="h-cap" className="gap-4 p-4 shadow-md min-[640px]:p-5">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-ink">
            1
          </span>
          <h2 id="h-cap" className="flex flex-col text-lg leading-tight font-bold">
            <span>{t.step1.th}</span>
            <En>{t.step1.en}</En>
          </h2>
        </div>

        <DropZone onFiles={addFiles} disabled={busy || rows.length >= MAX_FILES} />

        <p data-testid="queue-count" className="text-sm text-tx-2">
          {limit.th} · {limit.en}
        </p>

        {notices.length > 0 && (
          <div role="alert" className="flex items-start gap-3 rounded-control border border-err/50 bg-err/12 px-3.5 py-3 text-sm text-err-hi">
            <CircleAlert aria-hidden="true" className="mt-px size-5 shrink-0 text-err" />
            <div className="flex flex-col gap-1">
              {notices.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <ul data-testid="queue-rows" className="flex flex-col gap-3">
            {rows.map((r) => (
              <PhotoRow key={r.id} row={r} running={phase === 'running'} removeDisabled={busy} onRemove={remove} />
            ))}
          </ul>
        )}
      </Card>

      {rows.length > 0 && (
        <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-[5] -mx-4 flex flex-col gap-1.5 bg-bg/95 px-4 pt-2 pb-4 min-[640px]:static min-[640px]:mx-0 min-[640px]:bg-transparent min-[640px]:p-0 desk:bottom-0">
          <Button data-testid="detect-cta" size="lg" className="w-full whitespace-normal" disabled={cta.disabled} onClick={cta.onClick}>
            {cta.icon}
            <span>{bi(cta.label)}</span>
          </Button>
          {cta.help && <p className="text-center text-[13px] text-tx-3">{bi(cta.help)}</p>}
        </div>
      )}
    </div>
  )
}
