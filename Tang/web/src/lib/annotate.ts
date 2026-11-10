// Draws pipe boxes onto a canvas and downloads files. Box numbers come from detection.ts (toRect).
import type { PhotoEdits } from './corrections'
import { toRect, type Box, type DetectedPipe } from './detection'

// ui-v2 tokens: accent / warn / ok (same colours as the viewer).
export const COLOR_OK = '#22d3ee'
export const COLOR_LOW = '#fbbf24' // low confidence, please review
export const COLOR_ADDED = '#4ade80' // added by the user

// Corrected boxes: model boxes minus the removed ones, then the user-added ones.
export function drawBoxes(ctx: CanvasRenderingContext2D, pipes: DetectedPipe[], lineWidth: number, edits?: PhotoEdits) {
  const stroke = (box: Box, color: string) => {
    const { x, y, w, h } = toRect(box)
    ctx.strokeStyle = color
    ctx.strokeRect(x, y, w, h)
  }
  ctx.lineWidth = lineWidth
  pipes.forEach((p, i) => {
    if (!edits?.removed.includes(i)) stroke(p.box, p.lowConfidence ? COLOR_LOW : COLOR_OK)
  })
  edits?.added.forEach((b) => stroke(b, COLOR_ADDED))
}

// The photo with the (corrected) boxes burned in, as a PNG. Pass the upload file: boxes are in its pixel space.
export async function renderAnnotatedPng(file: File, pipes: DetectedPipe[], edits?: PhotoEdits): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bmp, 0, 0)
  bmp.close?.()
  drawBoxes(ctx, pipes, Math.max(2, Math.round(canvas.width / 400)), edits)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
