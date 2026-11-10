import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressImage, formatBytes, targetSize } from './compress'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('targetSize', () => {
  it('scales the long side down to maxSide and keeps aspect', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 2048, height: 1536 })
    expect(targetSize(3000, 4000)).toEqual({ width: 1536, height: 2048 })
    expect(targetSize(1000, 500, 400)).toEqual({ width: 400, height: 200 })
  })

  it('never upscales', () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(targetSize(2048, 100)).toEqual({ width: 2048, height: 100 })
  })

  it('rounds to whole pixels and never returns 0', () => {
    expect(targetSize(3001, 1999, 1000)).toEqual({ width: 1000, height: 666 })
    expect(targetSize(10000, 1, 100)).toEqual({ width: 100, height: 1 })
  })
})

describe('formatBytes', () => {
  it('formats B, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(380 * 1024)).toBe('380 KB')
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB')
    expect(formatBytes(0)).toBe('0 B')
  })
})

describe('compressImage', () => {
  function stubCanvas(outBytes: number) {
    const ctx = { drawImage: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((cb) => cb(new Blob([new Uint8Array(outBytes)], { type: 'image/jpeg' })))
    return { ctx, toBlob }
  }

  it('draws at target size and returns a smaller JPEG named .jpg', async () => {
    const { ctx, toBlob } = stubCanvas(300)
    const original = new File([new Uint8Array(1000)], 'yard.photo.png', { type: 'image/png' })

    const out = await compressImage(original)

    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1536)
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8)
    expect(out.file.name).toBe('yard.photo.jpg')
    expect(out.file.type).toBe('image/jpeg')
    expect(out.originalBytes).toBe(1000)
    expect(out.compressedBytes).toBe(300)
  })

  it('returns the natural size of the compressed file', async () => {
    stubCanvas(300)
    const out = await compressImage(new File([new Uint8Array(1000)], 'a.png'))
    expect(out).toMatchObject({ width: 2048, height: 1536 })
  })

  it('passes maxSide and quality options through', async () => {
    const { ctx, toBlob } = stubCanvas(10)
    await compressImage(new File([new Uint8Array(100)], 'a.jpg'), { maxSide: 400, quality: 0.6 })
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 400, 300)
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.6)
  })

  it('returns the original file unchanged when compression makes it bigger', async () => {
    stubCanvas(5000)
    const original = new File([new Uint8Array(1000)], 'small.jpg', { type: 'image/jpeg' })

    const out = await compressImage(original)

    expect(out.file).toBe(original)
    expect(out.originalBytes).toBe(1000)
    expect(out.compressedBytes).toBe(1000)
  })

  it('returns the decoded size of the original when it is sent as is', async () => {
    stubCanvas(5000)
    const out = await compressImage(new File([new Uint8Array(1000)], 'small.jpg', { type: 'image/jpeg' }))
    expect(out).toMatchObject({ width: 4000, height: 3000 })
  })

  it('rejects when JPEG export fails', async () => {
    stubCanvas(0)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null))
    await expect(compressImage(new File(['x'], 'a.jpg'))).rejects.toThrow()
  })
})
