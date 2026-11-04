import { describe, expect, it } from 'vitest'
import { LOW_CONFIDENCE, summarize, toDetectedImages, type CountsResponse } from './detection'

const sample: CountsResponse = {
  batch_id: 'b_1',
  images: [
    {
      image_id: 'img_1',
      filename: 'stack.jpg',
      count: 2,
      crop_box: [10, 20, 300, 200],
      pipes: [
        { box: [10, 20, 50, 50], confidence: 0.93 },
        { box: [70, 20, 50, 50], confidence: 0.3 },
      ],
      quality: { brightness: 'dark' },
      original_bytes: 3120000,
      error: null,
    },
    {
      image_id: 'img_2',
      filename: 'broken.jpg',
      count: null,
      crop_box: null,
      pipes: [],
      quality: null,
      original_bytes: 10,
      error: 'cannot decode image',
    },
  ],
}

describe('toDetectedImages', () => {
  it('maps a successful image to the app type and flags low confidence', () => {
    const [img] = toDetectedImages(sample)
    expect(img).toEqual({
      imageId: 'img_1',
      filename: 'stack.jpg',
      count: 2,
      cropBox: [10, 20, 300, 200],
      pipes: [
        { box: [10, 20, 50, 50], confidence: 0.93, lowConfidence: false },
        { box: [70, 20, 50, 50], confidence: 0.3, lowConfidence: true },
      ],
      brightness: 'dark',
      originalBytes: 3120000,
      error: null,
    })
  })

  it('treats a pipe exactly at the threshold as not low', () => {
    const resp: CountsResponse = {
      batch_id: 'b',
      images: [{ ...sample.images[0], pipes: [{ box: [0, 0, 1, 1], confidence: LOW_CONFIDENCE }] }],
    }
    expect(toDetectedImages(resp)[0].pipes[0].lowConfidence).toBe(false)
  })

  it('maps an error image to count 0 and keeps the error', () => {
    const img = toDetectedImages(sample)[1]
    expect(img.count).toBe(0)
    expect(img.error).toBe('cannot decode image')
    expect(img.pipes).toEqual([])
    expect(img.cropBox).toBeNull()
    expect(img.brightness).toBeNull()
  })
})

describe('summarize', () => {
  const img = (count: number, confs: number[], error: string | null = null) => ({
    imageId: 'i',
    filename: 'f',
    count,
    cropBox: null,
    pipes: confs.map((c) => ({ box: [0, 0, 1, 1] as [number, number, number, number], confidence: c, lowConfidence: c < LOW_CONFIDENCE })),
    brightness: null,
    originalBytes: 1,
    error,
  })

  it('sums counts and averages confidence across all pipes', () => {
    const s = summarize([img(2, [0.9, 0.5]), img(1, [0.4])])
    expect(s.count).toBe(3)
    expect(s.meanConfidence).toBeCloseTo(0.6)
  })

  it('ignores error photos and gives null confidence with no pipes', () => {
    expect(summarize([img(0, [], 'bad')])).toEqual({ count: 0, meanConfidence: null })
    expect(summarize([])).toEqual({ count: 0, meanConfidence: null })
  })
})
