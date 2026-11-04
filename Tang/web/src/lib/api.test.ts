import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRecordsQuery, confirmBatch, getRecordCounts, getStats, listAllRecords, listRecords } from './api'

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

  it('listAllRecords pages by 100 and stops at the cap', async () => {
    const f = vi.fn((url: string) => {
      const off = Number(new URL(url, 'http://x').searchParams.get('offset'))
      return json({ items: Array.from({ length: 100 }, (_, i) => rec(off + i)), total: 5000 })
    })
    vi.stubGlobal('fetch', f)
    const all = await listAllRecords({ filter: 'confirmed' }, 250)
    expect(all).toHaveLength(250)
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('getRecordCounts asks once per tab with limit=1', async () => {
    const f = vi.fn((url: string) => json({ items: [], total: url.includes('status=draft') ? 3 : 9 }))
    vi.stubGlobal('fetch', f)
    expect(await getRecordCounts('q')).toEqual({ all: 9, confirmed: 9, draft: 3, flagged: 9 })
    expect(f.mock.calls.every(([u]) => String(u).includes('limit=1&'))).toBe(true)
  })
})

describe('confirm + stats', () => {
  it('confirmBatch posts the right body', async () => {
    const f = vi.fn().mockReturnValue(json({ ...rec(1), status: 'confirmed', do_number: 'DX1', actual_amount: 4 }))
    vi.stubGlobal('fetch', f)
    const r = await confirmBatch('b1', { doNumber: ' DX1 ', actualAmount: 4, notes: ' hi ', imageIds: ['img_1', 'img_3'] })
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      do_number: 'DX1',
      actual_amount: 4,
      notes: 'hi',
      image_ids: ['img_1', 'img_3'],
    })
    expect(r.doNumber).toBe('DX1')
  })

  it('confirmBatch throws the API detail (409)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(json({ detail: 'batch already confirmed' }, 409)))
    await expect(
      confirmBatch('b', { doNumber: 'a', actualAmount: 1, notes: 'n', imageIds: ['img_1'] }),
    ).rejects.toThrow('batch already confirmed')
  })

  it('getStats maps fields and keeps a null rate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(json({ detections_today: 2, confirmed_total: 0, correction_rate: null, failed_images_today: 1 })),
    )
    expect(await getStats()).toEqual({ detectionsToday: 2, confirmedTotal: 0, correctionRate: null, failedImagesToday: 1 })
  })
})
