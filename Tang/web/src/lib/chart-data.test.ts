import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyStat, RecordRow } from './api'
import { dayTick, formatPct, toDaySeries, toModelVsActual, total, valueDomain } from './chart-data'

const day = (date: string, detections: number, pipesActual: number, confirmed: number, corrected: number): DailyStat => ({
  date,
  detections,
  pipesActual,
  confirmed,
  corrected,
  correctionRate: confirmed === 0 ? null : Math.round((corrected / confirmed) * 10000) / 10000,
})
// 7 Bangkok days, oldest first, last = today (shape of GET /api/stats/daily?days=7)
const WEEK: DailyStat[] = [
  day('2026-11-03', 7, 612, 3, 1),
  day('2026-11-04', 10, 845, 5, 1),
  day('2026-11-05', 8, 702, 7, 2),
  day('2026-11-06', 11, 930, 9, 2),
  day('2026-11-07', 4, 310, 4, 1),
  day('2026-11-08', 0, 0, 0, 0),
  day('2026-11-09', 12, 796, 8, 3),
]

const rec = (id: string, model: number, actual: number | null, confirmedAt: string | null): RecordRow => ({
  batchId: id,
  createdAt: '2026-11-01T00:00:00Z',
  operatorId: 'OP-07',
  doNumber: `DX${id}`,
  imageCount: 2,
  modelTotal: model,
  actualAmount: actual,
  variance: actual === null ? null : actual - model,
  status: actual === null ? 'draft' : 'confirmed',
  flagged: actual !== null && actual !== model,
  notes: null,
  confirmedAt,
})

describe('dayTick', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('gives the Thai day abbreviation and dd/mm of a plain YYYY-MM-DD', () => {
    expect(dayTick('2026-11-03')).toEqual({ th: 'อ.', dm: '03/11' }) // Tuesday
    expect(dayTick('2026-11-08')).toEqual({ th: 'อา.', dm: '08/11' }) // Sunday
    expect(dayTick('2026-11-09')).toEqual({ th: 'จ.', dm: '09/11' }) // Monday
  })

  it('is not shifted by the browser timezone', () => {
    for (const zone of ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
      vi.stubEnv('TZ', zone) // Node re-reads TZ when process.env.TZ changes
      expect(dayTick('2026-11-09')).toEqual({ th: 'จ.', dm: '09/11' })
      expect(dayTick('2026-01-01')).toEqual({ th: 'พฤ.', dm: '01/01' }) // Thursday
    }
  })
})

describe('toDaySeries', () => {
  it('7 days in -> 7 points, oldest first, only the last one is today', () => {
    const s = toDaySeries(WEEK)
    expect(s).toHaveLength(7)
    expect(s.map((p) => p.date)).toEqual(WEEK.map((d) => d.date))
    expect(s.map((p) => p.today)).toEqual([false, false, false, false, false, false, true])
    expect(s[0]).toMatchObject({ th: 'อ.', dm: '03/11', detections: 7, pipesActual: 612, confirmed: 3, corrected: 1 })
  })

  it('correction rate becomes a percent; a null rate stays null (gap, not 0)', () => {
    const s = toDaySeries(WEEK)
    expect(s[1].pct).toBeCloseTo(20)
    expect(s[5].pct).toBeNull()
    expect(s[5].confirmed).toBe(0)
  })

  it('totals over the window', () => {
    const s = toDaySeries(WEEK)
    expect(total(s, 'detections')).toBe(52)
    expect(total(s, 'pipesActual')).toBe(4195)
  })
})

describe('formatPct', () => {
  it('rounds a 0-1 rate to a whole percent; null -> dash', () => {
    expect(formatPct(0.25)).toBe('25%')
    expect(formatPct(0.3333)).toBe('33%')
    expect(formatPct(0)).toBe('0%')
    expect(formatPct(1)).toBe('100%')
    expect(formatPct(null)).toBe('—')
  })
})

describe('toModelVsActual', () => {
  // API order: newest first
  const NEWEST_FIRST = [
    rec('3', 120, 122, '2026-11-09T03:41:00Z'),
    rec('2', 96, 96, '2026-11-09T02:55:00Z'),
    rec('1', 88, 87, '2026-11-08T09:30:00Z'),
  ]

  it('orders oldest -> newest by confirmed time', () => {
    expect(toModelVsActual(NEWEST_FIRST).map((r) => r.label)).toEqual(['DX1', 'DX2', 'DX3'])
  })

  it('signed difference = actual - model, with a signed label', () => {
    const rows = toModelVsActual(NEWEST_FIRST)
    expect(rows.map((r) => r.diff)).toEqual([-1, 0, 2])
    expect(rows.map((r) => r.diffLabel)).toEqual(['-1', '0', '+2'])
    expect(rows[2]).toMatchObject({ model: 120, actual: 122, range: [120, 122] })
    expect(rows[0].range).toEqual([87, 88]) // low -> high even when actual < model
  })

  it('skips rows without an actual amount (never plots a fake value)', () => {
    expect(toModelVsActual([rec('9', 50, null, null), ...NEWEST_FIRST])).toHaveLength(3)
  })

  it('falls back to a short batch id when there is no DO number', () => {
    const r = { ...rec('abcdef123456', 10, 10, '2026-11-09T00:00:00Z'), doNumber: null }
    expect(toModelVsActual([r])[0].label).toBe('abcdef12')
  })
})

describe('valueDomain', () => {
  it('pads to clean steps of 20 around model and actual', () => {
    expect(valueDomain(toModelVsActual([rec('1', 88, 87, 'a'), rec('2', 120, 122, 'b')]))).toEqual([80, 140])
    expect(valueDomain(toModelVsActual([rec('1', 20, 20, 'a')]))).toEqual([0, 40])
  })

  it('never goes below 0', () => {
    expect(valueDomain(toModelVsActual([rec('1', 2, 3, 'a')]))[0]).toBe(0)
  })
})
