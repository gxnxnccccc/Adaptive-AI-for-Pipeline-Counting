// Client-side photo quality hints (too dark / too bright / blurry) before upload.
// Pure math is split from canvas I/O so it can be unit-tested without a browser.
import type { Brightness } from './detection'

// OPEN: tune on real yard photos (docs/api-contract.md)
export const DARK_LUMA = 60
export const BRIGHT_LUMA = 200
export const BLUR_VARIANCE = 100
const MAX_SIDE = 512

export type Quality = { brightness: Brightness; blur: 'ok' | 'blurry' }

const lumaAt = (d: ArrayLike<number>, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]

// Mean Rec.601 luma (0-255) of RGBA pixel data. Alpha is ignored.
export function meanLuma(data: Uint8ClampedArray): number {
  const n = data.length / 4
  if (n === 0) return 0
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += lumaAt(data, i)
  return sum / n
}

// Variance of the 3x3 Laplacian over interior pixels. Low = few edges = probably blurry.
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3) return 0
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const v = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
      sum += v
      sumSq += v * v
      n++
    }
  }
  const mean = sum / n
  return sumSq / n - mean * mean
}

export function assessQuality({ luma, sharpness }: { luma: number; sharpness: number }): Quality {
  return {
    brightness: luma < DARK_LUMA ? 'dark' : luma > BRIGHT_LUMA ? 'bright' : 'ok',
    blur: sharpness < BLUR_VARIANCE ? 'blurry' : 'ok',
  }
}

// Decode, downscale to MAX_SIDE, grayscale, then assess. Decode errors bubble up.
export async function checkImageQuality(file: File): Promise<Quality> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const width = Math.max(1, Math.round(bmp.width * scale))
  const height = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bmp, 0, 0, width, height)
  bmp.close?.()
  const { data } = ctx.getImageData(0, 0, width, height)
  const gray = new Float32Array(width * height)
  for (let p = 0; p < gray.length; p++) gray[p] = lumaAt(data, p * 4)
  return assessQuality({ luma: meanLuma(data), sharpness: laplacianVariance(gray, width, height) })
}
