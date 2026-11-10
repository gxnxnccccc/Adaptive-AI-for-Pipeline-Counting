// Resize + JPEG-compress a photo in the browser before upload (never send the raw full-size file).
export const MAX_SIDE = 2048
export const JPEG_QUALITY = 0.8

// Long side capped at maxSide, aspect kept, never upscaled, at least 1px.
export function targetSize(w: number, h: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// width/height = natural pixel size of `file` (the boxes the API returns are in this space).
export type Compressed = { file: File; originalBytes: number; compressedBytes: number; width: number; height: number }

export async function compressImage(file: File, opts: { maxSide?: number; quality?: number } = {}): Promise<Compressed> {
  const bmp = await createImageBitmap(file)
  const natural = { width: bmp.width, height: bmp.height }
  const { width, height } = targetSize(bmp.width, bmp.height, opts.maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bmp, 0, 0, width, height)
  bmp.close?.()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG export failed'))), 'image/jpeg', opts.quality ?? JPEG_QUALITY),
  )
  const originalBytes = file.size
  if (blob.size >= originalBytes) return { file, originalBytes, compressedBytes: originalBytes, ...natural }
  const name = file.name.replace(/\.[^.]*$/, '') + '.jpg'
  return { file: new File([blob], name, { type: 'image/jpeg' }), originalBytes, compressedBytes: blob.size, width, height }
}
