// Draws pipe boxes onto a canvas and downloads files. Box numbers come from detection.ts (toRect).
import { toRect, type DetectedPipe } from './detection'

export const COLOR_OK = '#16a34a' // green-600
export const COLOR_LOW = '#f97316' // orange-500: low confidence, please review

export function drawBoxes(ctx: CanvasRenderingContext2D, pipes: DetectedPipe[], lineWidth: number) {
  ctx.lineWidth = lineWidth
  for (const p of pipes) {
    const { x, y, w, h } = toRect(p.box)
    ctx.strokeStyle = p.lowConfidence ? COLOR_LOW : COLOR_OK
    ctx.strokeRect(x, y, w, h)
  }
}

// The original photo with boxes burned in, as a PNG.
export async function renderAnnotatedPng(file: File, pipes: DetectedPipe[]): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bmp, 0, 0)
  bmp.close?.()
  drawBoxes(ctx, pipes, Math.max(2, Math.round(bmp.width / 400)))
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
