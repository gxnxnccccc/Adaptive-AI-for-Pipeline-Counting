import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'
import type { Point, PhotoEdits } from '@/lib/corrections'
import { toRect, type Box, type DetectedPipe } from '@/lib/detection'
import { bi, t, type Pair } from '@/lib/i18n'
import { panBy, zoomAt, zoomedViewBox, type Zoom } from '@/lib/zoom'

export type View = 'crop' | 'full'
type Rect = { left: number; top: number; width: number; height: number }

// Space around the pipe area in crop view, as a fraction of the image's short side (preview: 18 px on 800x600).
export const CROP_PAD_FRACTION = 0.03

// viewBox in image pixels: the crop box + padding (kept inside the image), or the whole image.
// TODO(contract): crop_box OPEN (mock = union of pipe boxes, no padding). No crop box -> whole image.
export function viewBoxFor(view: View, cropBox: Box | null | undefined, imageW: number, imageH: number): Box {
  if (view === 'full' || !cropBox) return [0, 0, imageW, imageH]
  const pad = Math.round(CROP_PAD_FRACTION * Math.min(imageW, imageH))
  const { x, y, w, h } = toRect(cropBox)
  const x0 = Math.max(0, x - pad)
  const y0 = Math.max(0, y - pad)
  return [x0, y0, Math.min(imageW, x + w + pad) - x0, Math.min(imageH, y + h + pad) - y0]
}

// Screen point -> image pixels for an <svg> drawn with preserveAspectRatio="xMidYMid meet" (letterboxed, centred).
export function toImagePoint(clientX: number, clientY: number, rect: Rect, viewBox: Box): Point {
  const [vx, vy, vw, vh] = viewBox
  const s = Math.min(rect.width / vw, rect.height / vh)
  const ox = rect.left + (rect.width - vw * s) / 2
  const oy = rect.top + (rect.height - vh * s) / 2
  return { x: vx + (clientX - ox) / s, y: vy + (clientY - oy) / s }
}

type Props = {
  src: string
  // Natural pixel size of `src` (the upload file the boxes refer to).
  width: number
  height: number
  pipes: DetectedPipe[]
  edits?: PhotoEdits
  view?: View
  cropBox?: Box | null
  // Accessible name (e.g. "IMG_0412.jpg: 45 pipes"). Without it the SVG is decorative (thumbnails).
  label?: string
  // Click/tap anywhere on the photo, in image pixels. The page decides (corrections.hitTest) what it means.
  onPick?: (point: Point) => void
  // Thumbnails and the locked (submitting) state: no picking, thinner strokes.
  readOnly?: boolean
  // "Show only boxes to check": confident boxes fade out (still there and still tappable), so the
  // low-confidence ones stand out. Faded, not hidden, so a tap never hits a box you can't see.
  focusLow?: boolean
  // Zoom inside the current view (crop or full). With onZoom: drag pans, Ctrl/⌘ + wheel or a trackpad pinch zooms.
  zoom?: Zoom | null
  onZoom?: (z: Zoom | null) => void
  // Model box index to point out ("next box to check", key N).
  current?: number | null
}

// A drag shorter than this (screen px) is still a tap.
const DRAG_PX = 4

const BASE = 'box fill-transparent [vector-effect:non-scaling-stroke]'
const STYLE = {
  ok: 'box-ok stroke-accent',
  low: 'box-low stroke-warn [stroke-dasharray:6_4]',
  removed: 'box-removed stroke-err fill-err/15 opacity-75 [stroke-dasharray:3_4]',
  added: 'box-added stroke-ok fill-ok/15',
}

// One <svg> over the photo: the image + boxes share the image pixel space, so they line up at any size and in both views.
// Keyboard: boxes are not focusable (up to ~120 targets, spec ui-v2.md flag 7); the keyboard path is Undo + the Actual stepper.
export default function PhotoViewer({
  src,
  width,
  height,
  pipes,
  edits,
  view = 'crop',
  cropBox,
  label,
  onPick,
  readOnly = false,
  focusLow = false,
  zoom = null,
  onZoom,
  current = null,
}: Props) {
  const base = viewBoxFor(view, cropBox, width, height)
  const vb = zoomedViewBox(base, zoom)
  const removed = new Set(edits?.removed)
  const stroke = readOnly ? 1 : 2
  const live = !readOnly && !!onPick
  const hover = live ? 'cursor-pointer motion-safe:transition-[stroke-width] hover:[stroke-width:4]' : ''

  const svgRef = useRef<SVGSVGElement>(null)
  const zoomed = !!zoom && zoom.scale > 1
  // Pan: the pointer that went down, the zoom it started from, and whether it moved far enough to be a drag.
  const drag = useRef<{ id: number; x: number; y: number; from: Zoom; moved: boolean } | null>(null)
  const swallowClick = useRef(false)

  // Screen px per image px for the current view (letterboxed "meet").
  const pxPerUnit = (r: DOMRect) => Math.min(r.width / vb[2], r.height / vb[3])

  function pointerDown(e: PointerEvent<SVGSVGElement>) {
    if (!onZoom || !zoomed || e.button !== 0) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: zoom, moved: false }
  }
  function pointerMove(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId || !onZoom) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return
    if (!d.moved) e.currentTarget.setPointerCapture?.(e.pointerId)
    d.moved = true
    const s = pxPerUnit(e.currentTarget.getBoundingClientRect())
    onZoom(panBy(base, d.from, dx / s, dy / s))
  }
  function pointerUp(e: PointerEvent<SVGSVGElement>) {
    if (drag.current?.id !== e.pointerId) return
    swallowClick.current = drag.current.moved // the click that follows a drag is not a tap
    drag.current = null
  }

  // Ctrl/⌘ + wheel (also what a trackpad pinch sends) zooms around the cursor. Native listener: React's is passive.
  useEffect(() => {
    const el = svgRef.current
    if (!el || !onZoom) return
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return // plain wheel scrolls the page
      e.preventDefault()
      const pt = toImagePoint(e.clientX, e.clientY, el.getBoundingClientRect(), vb)
      const next = zoomAt(base, vb, pt, (zoom?.scale ?? 1) * Math.exp(-e.deltaY / 300))
      onZoom(next.scale <= 1 ? null : next)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })

  function click(e: MouseEvent<SVGSVGElement>) {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    if (!live) return
    const p = toImagePoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), vb)
    if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) return // letterbox bar, not the photo
    onPick(p)
  }

  return (
    <svg
      ref={svgRef}
      viewBox={vb.join(' ')}
      preserveAspectRatio="xMidYMid meet"
      // Zoomed: one-finger drag pans the photo instead of scrolling the page.
      className={`block size-full select-none ${zoomed && onZoom ? 'touch-none active:cursor-grabbing' : ''} ${live ? 'cursor-crosshair' : ''}`}
      onClick={click}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <image href={src} x={0} y={0} width={width} height={height} />
      {pipes.map((p, i) => {
        const { x, y, w, h } = toRect(p.box)
        const isRemoved = removed.has(i)
        const style = isRemoved ? STYLE.removed : p.lowConfidence ? STYLE.low : focusLow ? `${STYLE.ok} box-faded opacity-20` : STYLE.ok
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={4} strokeWidth={stroke} className={`${BASE} ${style} ${hover}`} />
            {isRemoved && (
              <line
                x1={x}
                y1={y}
                x2={x + w}
                y2={y + h}
                strokeWidth={stroke}
                className="strike pointer-events-none stroke-err opacity-90 [vector-effect:non-scaling-stroke]"
              />
            )}
          </g>
        )
      })}
      {current != null && pipes[current] && (
        <CurrentRing box={pipes[current].box} />
      )}
      {edits?.added.map((b, j) => {
        const { x, y, w, h } = toRect(b)
        return (
          <rect
            key={`a${j}`}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={4}
            strokeWidth={readOnly ? 1 : 2.5}
            className={`${BASE} ${STYLE.added} ${hover}`}
          />
        )
      })}
    </svg>
  )
}

// Pink ring around the box picked by "next box to check", a little outside it so the box style stays visible.
function CurrentRing({ box }: { box: Box }) {
  const { x, y, w, h } = toRect(box)
  const pad = Math.max(w, h) * 0.18
  return (
    <rect
      data-testid="box-current"
      x={x - pad}
      y={y - pad}
      width={w + 2 * pad}
      height={h + 2 * pad}
      rx={6}
      strokeWidth={4}
      className="pointer-events-none fill-transparent stroke-pink [vector-effect:non-scaling-stroke] motion-safe:animate-pulse"
    />
  )
}

const SWATCH = 'h-3.5 w-[18px] flex-none rounded-[3px] border-2'
const LEGEND: { text: Pair; swatch: string }[] = [
  { text: t.vwDetected, swatch: 'border-accent' },
  { text: t.vwLowConf, swatch: 'border-dashed border-warn' },
  {
    text: t.vwRemoved,
    swatch:
      'border-dashed border-err bg-[linear-gradient(to_bottom_right,transparent_42%,var(--color-err)_42%_58%,transparent_58%)]',
  },
  { text: t.vwAdded, swatch: 'border-ok bg-ok/15' },
]

// Colour key for the box styles. Each entry also has a text label, so colour is never the only cue.
export function BoxLegend() {
  return (
    <ul aria-label={bi(t.vwLegend)} className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[13px] text-tx-2">
      {LEGEND.map(({ text, swatch }) => (
        <li key={text.en} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`${SWATCH} ${swatch}`} />
          <span>{text.th}</span>
          <span className="text-tx-3">{text.en}</span>
        </li>
      ))}
    </ul>
  )
}
