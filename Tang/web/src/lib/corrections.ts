// Per-photo box corrections on the Result page (pure functions, no React).
// Rule: count shown = model count - removed + added. Edits are plain arrays so they survive re-renders and can be stored as-is.
import type { components } from './api-types'
import type { Box, DetectedImage, DetectedPipe } from './detection'
import { toRect } from './detection'

export type Point = { x: number; y: number }
export type Size = { w: number; h: number }

// One undo step. `index` is the position at the time of the action, so undoing newest-first restores the exact state.
export type Action =
  | { type: 'toggle'; index: number }
  | { type: 'add'; index: number }
  | { type: 'delete'; index: number; box: Box }

// removed = model pipe indexes (0-based in that photo's pipes[]), sorted. added = user boxes in image pixels.
export type PhotoEdits = { removed: number[]; added: Box[]; history: Action[] }

export const NO_EDITS: PhotoEdits = { removed: [], added: [], history: [] }

// TODO(contract): added-box size when a photo has 0 pipes is OPEN (circle vs box too). Assumed 8% of the short side.
export const DEFAULT_BOX_FRACTION = 0.08

function flip(removed: number[], i: number): number[] {
  return removed.includes(i) ? removed.filter((r) => r !== i) : [...removed, i].sort((a, b) => a - b)
}

export function toggleRemoved(e: PhotoEdits, i: number): PhotoEdits {
  return { ...e, removed: flip(e.removed, i), history: [...e.history, { type: 'toggle', index: i }] }
}

export function addBox(e: PhotoEdits, box: Box): PhotoEdits {
  return { ...e, added: [...e.added, box], history: [...e.history, { type: 'add', index: e.added.length }] }
}

export function deleteAdded(e: PhotoEdits, j: number): PhotoEdits {
  return {
    ...e,
    added: e.added.filter((_, k) => k !== j),
    history: [...e.history, { type: 'delete', index: j, box: e.added[j] }],
  }
}

export function undo(e: PhotoEdits): PhotoEdits {
  const last = e.history.at(-1)
  if (!last) return e
  const history = e.history.slice(0, -1)
  if (last.type === 'toggle') return { ...e, removed: flip(e.removed, last.index), history }
  if (last.type === 'add') return { ...e, added: e.added.filter((_, k) => k !== last.index), history }
  const added = [...e.added]
  added.splice(last.index, 0, last.box)
  return { ...e, added, history }
}

// Net change only: remove + restore is not an edit.
export function hasEdits(e: PhotoEdits | undefined): boolean {
  return !!e && (e.removed.length > 0 || e.added.length > 0)
}

export function correctedCount(modelCount: number, e: PhotoEdits | undefined): number {
  return e ? modelCount - e.removed.length + e.added.length : modelCount
}

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Size for a user-added box: median model box of the photo (fallback square when there are no pipes).
export function medianSize(pipes: DetectedPipe[], imageW: number, imageH: number): Size {
  if (pipes.length === 0) {
    const side = DEFAULT_BOX_FRACTION * Math.min(imageW, imageH)
    return { w: side, h: side }
  }
  const rects = pipes.map((p) => toRect(p.box))
  return { w: median(rects.map((r) => r.w)), h: median(rects.map((r) => r.h)) }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

// Box of `size` centred on the point, kept inside the image.
// TODO(contract): box format OPEN; built as [x, y, w, h] in image pixels like the adapter's Box.
export function boxAt(point: Point, size: Size, imageW: number, imageH: number): Box {
  const w = Math.min(size.w, imageW)
  const h = Math.min(size.h, imageH)
  return [clamp(point.x - w / 2, 0, imageW - w), clamp(point.y - h / 2, 0, imageH - h), w, h]
}

export type Hit = { kind: 'added' | 'model'; index: number } | null

function lastHit(point: Point, boxes: Box[]): number {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const { x, y, w, h } = toRect(boxes[i])
    if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) return i
  }
  return -1
}

// Which box is under the point: added boxes first (drawn on top), then model boxes; last drawn wins.
export function hitTest(point: Point, pipes: DetectedPipe[], added: Box[]): Hit {
  const a = lastHit(point, added)
  if (a >= 0) return { kind: 'added', index: a }
  const m = lastHit(
    point,
    pipes.map((p) => p.box),
  )
  return m >= 0 ? { kind: 'model', index: m } : null
}

// Structural, so the session's photo type fits without importing it.
export type CorrectablePhoto = { id: string; result: DetectedImage }
export type Totals = { model: number; corrected: number; removed: number; added: number }

// Over non-failed photos only (failed photos are not counted in the totals).
export function totals(photos: CorrectablePhoto[], edits: Record<string, PhotoEdits>): Totals {
  const t: Totals = { model: 0, corrected: 0, removed: 0, added: 0 }
  for (const p of photos) {
    if (p.result.error) continue
    const e = edits[p.id]
    t.model += p.result.count
    t.corrected += correctedCount(p.result.count, e)
    t.removed += e?.removed.length ?? 0
    t.added += e?.added.length ?? 0
  }
  return t
}

export type ImageCorrection = components['schemas']['ImageCorrection']

// `corrections[]` for POST /api/counts/{batch_id}/confirm: pass the kept photos; skips failed and unedited ones.
export function toCorrections(photos: CorrectablePhoto[], edits: Record<string, PhotoEdits>): ImageCorrection[] {
  return photos
    .filter((p) => !p.result.error && hasEdits(edits[p.id]))
    .map((p) => {
      const e = edits[p.id]
      return { image_id: p.result.imageId, removed: [...e.removed], added: e.added.map((b) => [...b] as Box) }
    })
}
