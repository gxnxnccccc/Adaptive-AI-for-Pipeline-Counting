import { afterEach, describe, expect, it, vi } from 'vitest'
import { COLOR_ADDED, COLOR_LOW, COLOR_OK, drawBoxes, renderAnnotatedPng } from './annotate'
import { NO_EDITS, addBox, toggleRemoved } from './corrections'
import type { DetectedPipe } from './detection'

const pipe = (x: number, c: number): DetectedPipe => ({ box: [x, 0, 10, 10], confidence: c, lowConfidence: c < 0.5 })

function fakeCtx() {
  return { strokeRect: vi.fn(), drawImage: vi.fn(), strokeStyle: '', lineWidth: 0 }
}

afterEach(() => vi.unstubAllGlobals())

describe('drawBoxes', () => {
  it('draws one rectangle per pipe, low confidence in the other color', () => {
    const ctx = fakeCtx()
    const colors: string[] = []
    ctx.strokeRect.mockImplementation(() => colors.push(ctx.strokeStyle))
    drawBoxes(ctx as unknown as CanvasRenderingContext2D, [pipe(0, 0.9), pipe(20, 0.2), pipe(40, 0.8)], 2)
    expect(ctx.strokeRect).toHaveBeenCalledTimes(3)
    expect(ctx.strokeRect).toHaveBeenCalledWith(20, 0, 10, 10)
    expect(colors).toEqual([COLOR_OK, COLOR_LOW, COLOR_OK])
  })

  it('uses the ui-v2 token colours', () => {
    expect([COLOR_OK, COLOR_LOW, COLOR_ADDED]).toEqual(['#22d3ee', '#fbbf24', '#4ade80'])
  })

  it('draws the corrected boxes: removed model boxes skipped, added boxes in green', () => {
    const ctx = fakeCtx()
    const colors: string[] = []
    ctx.strokeRect.mockImplementation(() => colors.push(ctx.strokeStyle))
    const edits = addBox(toggleRemoved(NO_EDITS, 1), [60, 5, 10, 10])
    drawBoxes(ctx as unknown as CanvasRenderingContext2D, [pipe(0, 0.9), pipe(20, 0.2), pipe(40, 0.8)], 2, edits)
    expect(ctx.strokeRect.mock.calls).toEqual([
      [0, 0, 10, 10],
      [40, 0, 10, 10],
      [60, 5, 10, 10],
    ])
    expect(colors).toEqual([COLOR_OK, COLOR_OK, COLOR_ADDED])
  })
})

describe('renderAnnotatedPng', () => {
  it('draws the photo then N boxes and returns a PNG blob', async () => {
    const ctx = fakeCtx()
    const blob = new Blob(['png'], { type: 'image/png' })
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(blob))

    const out = await renderAnnotatedPng(new File(['x'], 'a.png'), [pipe(0, 0.9), pipe(20, 0.2)])
    expect(out).toBe(blob)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2)
  })

  it('scales the stroke with the image width, even though close() zeroes the bitmap size', async () => {
    const ctx = fakeCtx()
    const bmp = { width: 2048, height: 1536, close: vi.fn(() => (bmp.width = bmp.height = 0)) }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bmp))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'])))

    await renderAnnotatedPng(new File(['x'], 'a.png'), [pipe(0, 0.9)])
    expect(ctx.lineWidth).toBe(5) // round(2048 / 400)
  })

  it('burns in the corrected boxes when edits are given', async () => {
    const ctx = fakeCtx()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'])))

    const edits = addBox(toggleRemoved(NO_EDITS, 0), [60, 5, 10, 10])
    await renderAnnotatedPng(new File(['x'], 'a.png'), [pipe(0, 0.9), pipe(20, 0.2)], edits)
    expect(ctx.strokeRect.mock.calls).toEqual([
      [20, 0, 10, 10],
      [60, 5, 10, 10],
    ])
  })
})
