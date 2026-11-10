import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BLUR_VARIANCE,
  BRIGHT_LUMA,
  DARK_LUMA,
  assessQuality,
  checkImageQuality,
  laplacianVariance,
  meanLuma,
} from './quality'

// RGBA pixels, all the same color.
function solid(n: number, r: number, g: number, b: number) {
  const d = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) d.set([r, g, b, 255], i * 4)
  return d
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('meanLuma', () => {
  it('is 0 for black and 255 for white', () => {
    expect(meanLuma(solid(4, 0, 0, 0))).toBe(0)
    expect(meanLuma(solid(4, 255, 255, 255))).toBeCloseTo(255)
  })

  it('uses Rec.601 weights (green brighter than red brighter than blue)', () => {
    expect(meanLuma(solid(1, 255, 0, 0))).toBeCloseTo(0.299 * 255)
    expect(meanLuma(solid(1, 0, 255, 0))).toBeCloseTo(0.587 * 255)
    expect(meanLuma(solid(1, 0, 0, 255))).toBeCloseTo(0.114 * 255)
  })

  it('ignores alpha and averages over pixels', () => {
    const d = new Uint8ClampedArray([0, 0, 0, 0, 200, 200, 200, 10])
    expect(meanLuma(d)).toBeCloseTo(100)
  })
})

describe('laplacianVariance', () => {
  it('is 0 for a flat image', () => {
    expect(laplacianVariance(new Uint8Array(25).fill(128), 5, 5)).toBe(0)
  })

  it('is high for a checkerboard and low for a gentle gradient', () => {
    const w = 8
    const checker = new Uint8Array(w * w).map((_, i) => (((i % w) + Math.floor(i / w)) % 2 ? 255 : 0))
    const gradient = new Uint8Array(w * w).map((_, i) => (i % w) * 10)
    expect(laplacianVariance(checker, w, w)).toBeGreaterThan(BLUR_VARIANCE)
    expect(laplacianVariance(gradient, w, w)).toBeLessThan(BLUR_VARIANCE)
  })

  it('returns 0 when the image is too small for a 3x3 kernel', () => {
    expect(laplacianVariance(new Uint8Array([0, 255, 0, 255]), 2, 2)).toBe(0)
  })
})

describe('assessQuality', () => {
  it('flags dark, ok and bright by the luma thresholds', () => {
    const sharp = BLUR_VARIANCE + 1
    expect(assessQuality({ luma: DARK_LUMA - 1, sharpness: sharp }).brightness).toBe('dark')
    expect(assessQuality({ luma: DARK_LUMA, sharpness: sharp }).brightness).toBe('ok')
    expect(assessQuality({ luma: BRIGHT_LUMA, sharpness: sharp }).brightness).toBe('ok')
    expect(assessQuality({ luma: BRIGHT_LUMA + 1, sharpness: sharp }).brightness).toBe('bright')
  })

  it('flags blurry below the sharpness threshold', () => {
    expect(assessQuality({ luma: 128, sharpness: BLUR_VARIANCE - 1 }).blur).toBe('blurry')
    expect(assessQuality({ luma: 128, sharpness: BLUR_VARIANCE }).blur).toBe('ok')
  })
})

describe('checkImageQuality', () => {
  function stubCanvas(pixels: Uint8ClampedArray) {
    const ctx = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    return ctx
  }

  it('downscales to max 512px long side and reports a dark flat photo as dark + blurry', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 2048, height: 1024, close: vi.fn() }))
    const ctx = stubCanvas(solid(512 * 256, 10, 10, 10))

    const q = await checkImageQuality(new File(['x'], 'a.jpg'))

    expect(q).toEqual({ brightness: 'dark', blur: 'blurry' })
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 256)
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 512, 256)
  })

  it('lets decode errors bubble up', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad image')))
    await expect(checkImageQuality(new File(['x'], 'a.jpg'))).rejects.toThrow('bad image')
  })
})
