// The ONLY file that reads raw API/model fields. Everything else uses the app types below.
// If the ML team changes the format, change this file only (docs/api-contract.md).
import type { components } from './api-types'

export type CountsResponse = components['schemas']['CountsResponse']

// TODO(contract): low-confidence threshold for the "review this pipe" highlight is OPEN.
// Confidence below this is flagged for review, never silently counted as certain.
export const LOW_CONFIDENCE = 0.5

// TODO(contract): box format OPEN. Assumed [x, y, w, h] in image pixels (mock detector).
export type Box = [number, number, number, number]

export type DetectedPipe = {
  box: Box
  // TODO(contract): confidence scale OPEN. Assumed 0-1.
  confidence: number
  lowConfidence: boolean
}

export type Brightness = 'ok' | 'dark' | 'bright'

export type DetectedImage = {
  imageId: string
  filename: string
  // Model count. Error images get 0; user corrections are layered on top elsewhere.
  count: number
  // TODO(contract): crop_box OPEN (model-provided or computed from pipe boxes?).
  cropBox: Box | null
  pipes: DetectedPipe[]
  // null when the API gave no quality info (e.g. error images).
  brightness: Brightness | null
  originalBytes: number
  error: string | null
}

function toBox(raw: number[]): Box {
  // TODO(contract): [x,y,w,h] vs [x1,y1,x2,y2] and pixels vs normalized are OPEN.
  const [x = 0, y = 0, w = 0, h = 0] = raw
  return [x, y, w, h]
}

export function toDetectedImages(resp: CountsResponse): DetectedImage[] {
  return resp.images.map((img) => ({
    imageId: img.image_id,
    filename: img.filename,
    count: img.count ?? 0,
    cropBox: img.crop_box ? toBox(img.crop_box) : null,
    pipes: img.pipes.map((p) => ({
      box: toBox(p.box),
      confidence: p.confidence,
      lowConfidence: p.confidence < LOW_CONFIDENCE,
    })),
    // API sends a free string; unknown values fall back to 'ok'.
    brightness: img.quality ? toBrightness(img.quality.brightness) : null,
    originalBytes: img.original_bytes,
    error: img.error ?? null,
  }))
}

function toBrightness(raw: string): Brightness {
  return raw === 'dark' || raw === 'bright' ? raw : 'ok'
}

// ---- Box maths and result summaries (the only place that interprets box numbers) ----

export type Rect = { x: number; y: number; w: number; h: number }

// TODO(contract): box format OPEN. Today a Box is [x, y, w, h] in image pixels.
export function toRect(box: Box): Rect {
  const [x, y, w, h] = box
  return { x, y, w, h }
}

// Mean confidence over pipes; null when there are none.
export function meanConfidence(pipes: DetectedPipe[]): number | null {
  if (pipes.length === 0) return null
  return pipes.reduce((sum, p) => sum + p.confidence, 0) / pipes.length
}

export type ResultTotals = { count: number; meanConfidence: number | null }

// Totals over the photos still in the result: sum of model counts, and mean confidence across all their pipes.
export function summarize(images: DetectedImage[]): ResultTotals {
  const ok = images.filter((i) => !i.error)
  return {
    count: ok.reduce((sum, i) => sum + i.count, 0),
    meanConfidence: meanConfidence(ok.flatMap((i) => i.pipes)),
  }
}
