import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Crop, Download, Eye, FileX, Info, Maximize, Trash2, TriangleAlert, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import ConfirmPanel, { type ConfirmSubmit } from '@/components/ConfirmPanel'
import PhotoStrip from '@/components/PhotoStrip'
import PhotoViewer, { BoxLegend, viewBoxFor, type View } from '@/components/PhotoViewer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { downloadBlob, renderAnnotatedPng } from '@/lib/annotate'
import { confirmBatch } from '@/lib/api'
import {
  NO_EDITS,
  addBox,
  boxAt,
  correctedCount,
  deleteAdded,
  hitTest,
  medianSize,
  toCorrections,
  toggleRemoved,
  undo,
  type PhotoEdits,
  type Point,
} from '@/lib/corrections'
import { useDetectionSession, type SessionPhoto } from '@/lib/detection-session'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { MAX_ZOOM, nextScale, zoomAt, zoomToBox, zoomedViewBox, type Zoom } from '@/lib/zoom'

// One object URL per upload file (the boxes are in its pixel space), revoked when the photos change or on unmount.
function useUploadUrls(photos: SessionPhoto[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const next = Object.fromEntries(photos.map((p) => [p.id, URL.createObjectURL(p.upload)]))
    // Must be in the effect (not useMemo): StrictMode runs cleanup then setup again, which needs fresh URLs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(next)
    return () => Object.values(next).forEach((u) => URL.revokeObjectURL(u))
  }, [photos])
  return urls
}

// Tap on the photo: an added box is deleted, a model box is removed/restored, empty space adds a median-sized box.
function applyPick(p: SessionPhoto, e: PhotoEdits, pt: Point): PhotoEdits {
  const hit = hitTest(pt, p.result.pipes, e.added)
  if (hit?.kind === 'added') return deleteAdded(e, hit.index)
  if (hit?.kind === 'model') return toggleRemoved(e, hit.index)
  return addBox(e, boxAt(pt, medianSize(p.result.pipes, p.width, p.height), p.width, p.height))
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

function Bi({ p, className }: { p: Pair; className?: string }) {
  return (
    <span className={cn('flex flex-col leading-tight', className)}>
      <span>{p.th}</span>
      <span className="text-xs font-normal text-tx-3">{p.en}</span>
    </span>
  )
}

// Keyboard shortcuts by physical key (e.code), so they also work on the Thai layout (Z types "ผ" there).
// Ignored while typing in a field or with Ctrl/⌘/Alt held (Ctrl+Z in the notes box stays the browser's own undo).
function Shortcuts({ keys }: { keys: Record<string, (() => void) | null> }) {
  const latest = useRef(keys)
  useEffect(() => {
    latest.current = keys
  })
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      const run = latest.current[e.code]
      if (!run) return
      e.preventDefault()
      run()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
  return null
}

function Kbd({ k }: { k: string }) {
  return (
    <kbd className="rounded-[5px] border border-line-2 bg-surface px-1.5 font-mono text-[11px] font-semibold text-tx shadow-[0_1px_0_var(--color-line-2)]">
      {k}
    </kbd>
  )
}

const ZOOM_BTN =
  'grid size-11 cursor-pointer place-items-center rounded-[9px] text-tx-2 hover:bg-raised hover:text-tx disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent'

const VIEWS: { v: View; icon: typeof Crop; text: Pair }[] = [
  { v: 'crop', icon: Crop, text: t.viewCrop },
  { v: 'full', icon: Maximize, text: t.viewFull },
]

// Result page (ui-v2 tasks 8b + 8c): viewer card on the left, totals + confirm panel on the right.
export default function Result() {
  const { photos, batchId, edits, setEdits, removePhoto, setLastSavedDo, clear } = useDetectionSession()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>('crop')
  const [focusLow, setFocusLow] = useState(false)
  // Zoom + "next box to check" belong to one photo in one view: both reset when either changes.
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const [current, setCurrent] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  // Submit in flight: the viewer and its actions are locked.
  const [locked, setLocked] = useState(false)
  const urls = useUploadUrls(photos)
  const navigate = useNavigate()

  // Nothing detected yet (direct link, reload, after submit/cancel): back to Processing.
  if (!batchId) return <Navigate to="/processing" replace />

  const index = Math.max(
    0,
    photos.findIndex((p) => p.id === selectedId),
  )
  const photo = photos[index] as SessionPhoto | undefined

  function restart() {
    clear()
    navigate('/processing', { replace: true })
  }

  // Kept photos = every photo still in the session (failed ones too; the API leaves them out of model_total).
  async function submit(v: ConfirmSubmit) {
    if (!batchId) throw new Error('No saved batch, please upload again')
    const record = await confirmBatch(batchId, {
      ...v,
      imageIds: photos.map((p) => p.result.imageId),
      corrections: toCorrections(photos, edits),
    })
    setLastSavedDo(record.doNumber ?? v.doNumber)
    restart()
  }

  const confirm = (
    <ConfirmPanel photos={photos} edits={edits} onSubmit={submit} onCancel={restart} onBusyChange={setLocked} />
  )

  function resetZoom() {
    setZoom(null)
    setCurrent(null)
  }

  function select(id: string) {
    setSelectedId(id)
    resetZoom()
    setMsg(null) // a download / remove message belongs to the photo it was about
  }

  if (!photo) {
    return (
      <>
        <p className="text-tx-2">{bi(t.noPhotosLeft)}</p>
        {confirm}
      </>
    )
  }

  const p = photo
  const failed = !!p.result.error
  const e = edits[p.id] ?? NO_EDITS
  const count = correctedCount(p.result.count, e)
  const removed = new Set(e.removed)
  const toCheck = p.result.pipes.filter((x, i) => x.lowConfidence && !removed.has(i)).length
  const name = p.original.name
  const canEdit = !failed && !locked
  const canUndo = canEdit && e.history.length > 0

  // Model boxes still to check, in detection order; N walks through them (and wraps).
  const lowList = p.result.pipes.flatMap((x, i) => (x.lowConfidence && !removed.has(i) ? [i] : []))
  const pos = current == null ? -1 : lowList.indexOf(current)
  const base = viewBoxFor(failed ? 'full' : view, p.result.cropBox, p.width, p.height, e.added)
  const scale = zoom?.scale ?? 1

  function nextToCheck() {
    if (!canEdit || lowList.length === 0) return
    const i = lowList.find((j) => current == null || j > current) ?? lowList[0]
    setCurrent(i)
    setZoom(zoomToBox(base, p.result.pipes[i].box, 3))
  }

  function zoomBy(dir: 1 | -1) {
    const vb = zoomedViewBox(base, zoom)
    const z = zoomAt(base, vb, { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2 }, nextScale(scale, dir))
    setZoom(z.scale <= 1 ? null : z)
  }

  function changeView(v: View) {
    setView(v)
    resetZoom()
  }

  async function saveResult() {
    setMsg(null)
    try {
      const file = `${baseName(name)}_result.png`
      downloadBlob(await renderAnnotatedPng(p.upload, p.result.pipes, e), file)
      setMsg({ text: bi(t.downloaded(file)) })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : String(err), err: true })
    }
  }

  function saveOriginal() {
    downloadBlob(p.original, name)
    setMsg({ text: bi(t.downloaded(name)) })
  }

  function remove() {
    const next = photos[index + 1] ?? photos[index - 1]
    removePhoto(p.id)
    setSelectedId(next?.id ?? null)
    resetZoom()
    setMsg({ text: bi(t.photoRemoved) })
  }

  return (
    // Phone: photo -> confirm -> save/remove (DOM order). Desktop: photo + tools left, confirm sticky right.
    <div className="flex min-w-0 flex-col gap-4 min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_400px] min-[1180px]:grid-rows-[auto_1fr] min-[1180px]:items-start min-[1180px]:gap-5">
      <Card role="region" aria-labelledby="v-name" aria-busy={locked} className="min-w-0 gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:px-4 sm:py-3.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex flex-col leading-tight">
              <span id="v-name" className="font-mono text-base font-bold">
                {name}
              </span>
              <span className="text-xs text-tx-3">{bi(t.photoPos(index + 1, photos.length))}</span>
            </span>
            {!failed && (
              <span
                data-testid="photo-count"
                aria-live="polite"
                className="flex items-baseline gap-1.5 rounded-control border border-line bg-bg px-3 py-0.5"
              >
                <b className="font-mono text-[28px] leading-[1.15] tabular-nums">{count}</b>
                <Bi p={t.pipesUnit} />
              </span>
            )}
            {!failed && toCheck > 0 && (
              <button
                type="button"
                data-testid="to-check"
                aria-pressed={focusLow}
                onClick={() => setFocusLow((f) => !f)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-warn/40 bg-warn/12 px-3 text-[13px] font-semibold text-warn hover:bg-warn/20 aria-pressed:border-warn aria-pressed:bg-warn aria-pressed:text-surface"
              >
                <TriangleAlert aria-hidden="true" className="size-4" />
                <span>
                  {t.toCheck.th} <span className="font-mono">{toCheck}</span>
                </span>
                <span className="text-xs font-normal opacity-85">{t.toCheck.en}</span>
                <span className="ml-0.5 flex items-center gap-1 border-l border-current/40 pl-2 text-xs">
                  <Eye aria-hidden="true" className="size-3.5" />
                  <span className="font-semibold">{t.onlyToCheck.th}</span>
                  <span className="font-normal opacity-85">{t.onlyToCheck.en}</span>
                </span>
              </button>
            )}
          </div>
          {!failed && (
            <div role="group" aria-label={bi(t.photoView)} className="inline-flex rounded-xl border border-line bg-bg p-[3px]">
              {VIEWS.map(({ v, icon: Icon, text }) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => changeView(v)}
                  className="group flex min-h-11 cursor-pointer items-center gap-2 rounded-[9px] px-2 text-sm font-semibold text-tx-2 aria-pressed:bg-raised aria-pressed:text-tx aria-pressed:shadow-[inset_0_0_0_1px_var(--color-line-2)] sm:px-3"
                >
                  <Icon aria-hidden="true" className="size-4 group-aria-pressed:text-accent" />
                  <span>{text.th}</span>
                  <span className="sr-only text-xs font-normal text-tx-3 sm:not-sr-only">{text.en}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          data-testid="viewer"
          className={cn(
            'relative mx-2 aspect-square touch-manipulation overflow-hidden rounded-control border border-line bg-photo-bg select-none sm:mx-4 sm:aspect-[4/3] sm:max-h-[620px]',
            locked && 'pointer-events-none',
          )}
        >
          {urls[p.id] && (
            <PhotoViewer
              src={urls[p.id]}
              width={p.width}
              height={p.height}
              pipes={p.result.pipes}
              edits={e}
              view={failed ? 'full' : view}
              cropBox={p.result.cropBox}
              label={`${name}: ${failed ? bi(t.failTitle) : `${count} ${bi(t.pipesUnit)}`}`}
              onPick={failed || locked ? undefined : (pt) => setEdits(p.id, applyPick(p, e, pt))}
              readOnly={failed || locked}
              focusLow={focusLow && toCheck > 0}
              zoom={zoom}
              onZoom={canEdit ? (z) => setZoom(z) : undefined}
              current={current}
            />
          )}
          {!failed && (
            <div
              role="group"
              aria-label={bi(t.zoom)}
              className="absolute right-3 bottom-3 z-[1] flex items-center rounded-xl border border-line bg-surface/90 p-[3px] shadow-sm backdrop-blur-sm"
            >
              <button type="button" className={ZOOM_BTN} aria-label={bi(t.zoomOut)} disabled={locked || !zoom} onClick={() => zoomBy(-1)}>
                <ZoomOut aria-hidden="true" className="size-5" />
              </button>
              <button
                type="button"
                data-testid="zoom-level"
                className={cn(ZOOM_BTN, 'w-14 font-mono text-xs font-semibold tabular-nums')}
                aria-label={`${bi(t.zoomReset)} (${Math.round(scale * 100)}%)`}
                disabled={locked || !zoom}
                onClick={resetZoom}
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                className={ZOOM_BTN}
                aria-label={bi(t.zoomIn)}
                disabled={locked || scale >= MAX_ZOOM}
                onClick={() => zoomBy(1)}
              >
                <ZoomIn aria-hidden="true" className="size-5" />
              </button>
            </div>
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-2">
            <i className="absolute top-0 left-0 size-5 border-t-2 border-l-2 border-accent opacity-80" />
            <i className="absolute top-0 right-0 size-5 border-t-2 border-r-2 border-accent opacity-80" />
            <i className="absolute bottom-0 left-0 size-5 border-b-2 border-l-2 border-accent opacity-80" />
            <i className="absolute right-0 bottom-0 size-5 border-r-2 border-b-2 border-accent opacity-80" />
          </div>
          {failed && (
            <div
              data-testid="viewer-failed"
              className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2 bg-[rgba(10,6,8,.86)] p-6 text-center"
            >
              <span className="grid size-[60px] place-items-center rounded-full bg-err/12 text-err">
                <FileX aria-hidden="true" className="size-8" />
              </span>
              <h3 className="text-lg font-bold">
                <Bi p={t.failTitle} />
              </h3>
              <p className="max-w-[420px] text-sm text-tx-2">
                {p.result.error} · {bi(t.notCounted)}
              </p>
              <p className="max-w-[420px] text-sm text-tx-2">{bi(t.failHint)}</p>
            </div>
          )}
          {locked && <div aria-hidden="true" className="absolute inset-0 z-[2] bg-bg/35" />}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
          {!failed && (
            <p className="flex min-w-[220px] flex-1 items-start gap-2 text-[15px] font-semibold">
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
              <Bi p={t.tapHelp} />
            </p>
          )}
          <Button variant="secondary" disabled={!canUndo} onClick={() => setEdits(p.id, undo(e))}>
            <Undo2 aria-hidden="true" className="size-5" />
            <span>{t.undo.th}</span>
            <span className="text-xs font-normal text-tx-3">{t.undo.en}</span>
          </Button>
        </div>
        {!failed && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 text-xs text-tx-3">
            {/* Mouse/keyboard devices only: a phone has no Z / N keys. */}
            <p className="hidden items-center gap-1.5 pointer-fine:flex">
              <span className="font-semibold text-tx-2">{bi(t.shortcuts)}:</span>
              <Kbd k="Z" /> {bi(t.keyUndo)}
              {lowList.length > 0 && (
                <>
                  <span aria-hidden="true">·</span> <Kbd k="N" /> {bi(t.keyNext)}
                </>
              )}
            </p>
            {zoom && <p>{bi(t.dragToMove)}</p>}
            <p role="status" data-testid="box-pos" className="font-semibold text-pink-ink empty:hidden">
              {pos >= 0 ? bi(t.boxPos(pos + 1, lowList.length)) : ''}
            </p>
          </div>
        )}
        <Shortcuts
          keys={{
            KeyZ: canUndo ? () => setEdits(p.id, undo(e)) : null,
            KeyN: canEdit && lowList.length > 0 ? nextToCheck : null,
          }}
        />
        <div className="px-4 pt-2.5 pb-1">
          <BoxLegend />
        </div>

        <PhotoStrip photos={photos} edits={edits} urls={urls} selectedId={p.id} onSelect={select} />
      </Card>

      <div className="flex min-w-0 flex-col gap-4 min-[1180px]:sticky min-[1180px]:top-4 min-[1180px]:col-start-2 min-[1180px]:row-span-2 min-[1180px]:row-start-1">
        {confirm}
      </div>

      <Card role="group" aria-label={bi(t.photoTools)} className="min-w-0 gap-0 py-0 min-[1180px]:col-start-1 min-[1180px]:row-start-2">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <Button variant="secondary" className="max-sm:flex-[1_1_140px]" disabled={locked} onClick={saveOriginal}>
            <Download aria-hidden="true" className="size-5" />
            <Bi p={t.vwSaveOriginal} />
          </Button>
          <Button variant="secondary" className="max-sm:flex-[1_1_140px]" disabled={locked || failed} onClick={saveResult}>
            <Download aria-hidden="true" className="size-5" />
            <Bi p={t.vwSaveResult} />
          </Button>
          <Button variant="danger" className="max-sm:flex-[1_1_140px] sm:ml-auto" disabled={locked || photos.length < 2} onClick={remove}>
            <Trash2 aria-hidden="true" className="size-5" />
            <Bi p={t.vwRemovePhoto} />
          </Button>
          <span role="status" className={cn('basis-full text-[13px] empty:hidden', msg?.err ? 'text-err' : 'text-ok')}>
            {msg?.text}
          </span>
        </div>
      </Card>
    </div>
  )
}
