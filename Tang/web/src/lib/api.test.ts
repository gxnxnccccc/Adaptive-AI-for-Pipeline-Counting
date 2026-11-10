import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRecordsQuery, confirmBatch, getDailyStats, getStats, listRecords, uploadImages } from './api'

const rec = (n: number) => ({
  batch_id: `b${n}`,
  created_at: '2026-11-04T00:00:00Z',
  operator_id: 'OP',
  do_number: null,
  image_count: 1,
  model_total: 5,
  actual_amount: null,
  variance: null,
  status: 'draft',
  flagged: false,
  notes: null,
  confirmed_at: null,
})
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

afterEach(() => vi.unstubAllGlobals())

describe('records query', () => {
  it('builds filter, search and paging', () => {
    expect(buildRecordsQuery({})).toBe('limit=20&offset=0')
    expect(buildRecordsQuery({ filter: 'flagged', q: ' DX1 ', limit: 20, offset: 40 })).toBe(
      'limit=20&offset=40&status=flagged&q=DX1',
    )
    expect(buildRecordsQuery({ filter: 'all', q: '  ' })).toBe('limit=20&offset=0')
  })

  it('listRecords sends it and maps rows; API message on error', async () => {
    const f = vi
      .fn()
      .mockReturnValueOnce(json({ items: [rec(1)], total: 1 }))
      .mockReturnValueOnce(json({ detail: 'database not configured: x' }, 503))
    vi.stubGlobal('fetch', f)
    const page = await listRecords({ filter: 'draft', q: 'a', offset: 20 })
    expect(String(f.mock.calls[0][0])).toContain('/api/counts?limit=20&offset=20&status=draft&q=a')
    expect(page.items[0].batchId).toBe('b1')
    await expect(listRecords({})).rejects.toThrow('database not configured: x')
  })
})

describe('confirm + stats', () => {
  it('confirmBatch posts the right body, incl. image_ids and corrections', async () => {
    const f = vi.fn().mockReturnValue(json({ ...rec(1), status: 'confirmed', do_number: 'DX1', actual_amount: 4 }))
    vi.stubGlobal('fetch', f)
    const corrections = [
      { image_id: 'img_1', removed: [0, 5], added: [[120, 340, 48, 47] as [number, number, number, number]] },
      { image_id: 'img_3', removed: [2], added: [] },
    ]
    const r = await confirmBatch('b1', { doNumber: ' DX1 ', actualAmount: 4, notes: ' hi ', imageIds: ['img_1', 'img_3'], corrections })
    expect(String(f.mock.calls[0][0])).toContain('/api/counts/b1/confirm')
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      do_number: 'DX1',
      actual_amount: 4,
      notes: 'hi',
      image_ids: ['img_1', 'img_3'],
      corrections: [
        { image_id: 'img_1', removed: [0, 5], added: [[120, 340, 48, 47]] },
        { image_id: 'img_3', removed: [2], added: [] },
      ],
    })
    expect(r.doNumber).toBe('DX1')
  })

  it('confirmBatch throws the API detail (409)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(json({ detail: 'batch already confirmed' }, 409)))
    await expect(
      confirmBatch('b', { doNumber: 'a', actualAmount: 1, notes: 'n', imageIds: ['img_1'], corrections: [] }),
    ).rejects.toThrow('batch already confirmed')
  })

  it('getStats maps fields and keeps a null rate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(json({ detections_today: 2, confirmed_total: 0, correction_rate: null, failed_images_today: 1 })),
    )
    expect(await getStats()).toEqual({ detectionsToday: 2, confirmedTotal: 0, correctionRate: null, failedImagesToday: 1 })
  })

  it('getDailyStats asks for N days and maps snake_case -> camelCase, null rate kept', async () => {
    const f = vi.fn().mockReturnValue(
      json({
        days: [
          { date: '2026-11-08', detections: 0, pipes_actual: 0, confirmed: 0, corrected: 0, correction_rate: null },
          { date: '2026-11-09', detections: 5, pipes_actual: 412, confirmed: 4, corrected: 1, correction_rate: 0.25 },
        ],
      }),
    )
    vi.stubGlobal('fetch', f)
    expect(await getDailyStats(2)).toEqual([
      { date: '2026-11-08', detections: 0, pipesActual: 0, confirmed: 0, corrected: 0, correctionRate: null },
      { date: '2026-11-09', detections: 5, pipesActual: 412, confirmed: 4, corrected: 1, correctionRate: 0.25 },
    ])
    expect(String(f.mock.calls[0][0])).toContain('/api/stats/daily?days=2')
  })

  it('getDailyStats defaults to 7 days and throws the API detail', async () => {
    const f = vi.fn().mockReturnValue(json({ detail: 'database not configured: x' }, 503))
    vi.stubGlobal('fetch', f)
    await expect(getDailyStats()).rejects.toThrow('database not configured: x')
    expect(String(f.mock.calls[0][0])).toContain('/api/stats/daily?days=7')
  })
})

describe('uploadImages', () => {
  const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })

  it('throws the API detail on an error status (503)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(json({ detail: 'detector not ready' }, 503)))
    await expect(uploadImages([file], 'OP')).rejects.toThrow('detector not ready')
  })

  it("maps a network failure (fetch TypeError) to the bilingual can't-reach-API text", async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(uploadImages([file], 'OP')).rejects.toThrow("เชื่อมต่อ API ไม่ได้ · Can't reach the API.")
  })
})
