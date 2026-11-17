import type { Point } from '@/lib/corrections'
import type { Box } from '@/lib/detection'

// Zoom inside the photo viewer: `scale` x the base view (crop or full), centred on (cx, cy) in image pixels.
export type Zoom = { scale: number; cx: number; cy: number }

export const ZOOM_STEPS = [1, 1.5, 2, 3, 4]
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// The viewBox to draw: the base view shrunk by `scale`, kept inside the base view.
export function zoomedViewBox(base: Box, z: Zoom | null | undefined): Box {
  if (!z || z.scale <= 1) return base
  const [bx, by, bw, bh] = base
  const w = bw / z.scale
  const h = bh / z.scale
  return [clamp(z.cx - w / 2, bx, bx + bw - w), clamp(z.cy - h / 2, by, by + bh - h), w, h]
}

// Store the centre that is actually drawn, so a pan never has to "use up" an overshoot first.
function settle(base: Box, z: Zoom): Zoom {
  const [x, y, w, h] = zoomedViewBox(base, z)
  return { scale: z.scale, cx: x + w / 2, cy: y + h / 2 }
}

// Next button step up (dir 1) or down (dir -1) from any scale (wheel zoom leaves in-between values).
export function nextScale(scale: number, dir: 1 | -1): number {
  const eps = 1e-6
  return dir > 0
    ? (ZOOM_STEPS.find((s) => s > scale + eps) ?? MAX_ZOOM)
    : ([...ZOOM_STEPS].reverse().find((s) => s < scale - eps) ?? 1)
}

// Zoom to `scale` while the image point `pt` stays under the cursor (wheel / buttons use the view centre).
export function zoomAt(base: Box, current: Box, pt: Point, scale: number): Zoom {
  const s = clamp(scale, 1, MAX_ZOOM)
  const w = base[2] / s
  const h = base[3] / s
  const x = pt.x - (pt.x - current[0]) * (w / current[2])
  const y = pt.y - (pt.y - current[1]) * (h / current[3])
  return settle(base, { scale: s, cx: x + w / 2, cy: y + h / 2 })
}

// Drag by (dx, dy) image pixels: the photo follows the finger, so the view moves the other way.
export function panBy(base: Box, z: Zoom, dx: number, dy: number): Zoom {
  return settle(base, { ...z, cx: z.cx - dx, cy: z.cy - dy })
}

// "Next box to check" (N): centre that box at `scale`.
export function zoomToBox(base: Box, box: Box, scale = 3): Zoom {
  const [x, y, w, h] = box
  return settle(base, { scale: clamp(scale, 1, MAX_ZOOM), cx: x + w / 2, cy: y + h / 2 })
}
