// Pure transforms for the Dashboard charts (task 10b). No React, no fetch.
import type { DailyStat, RecordRow } from './api'
import { formatVariance } from './confirm'

const TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'] // Sun..Sat

// "2026-11-09" -> { th: 'จ.', dm: '09/11' }. Read as a calendar date (UTC math), so the browser timezone never shifts it.
export function dayTick(date: string): { th: string; dm: string } {
  const [y, m, d] = date.split('-').map(Number)
  return { th: TH_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], dm: `${date.slice(8, 10)}/${date.slice(5, 7)}` }
}

export type DayPoint = DailyStat & { th: string; dm: string; today: boolean; pct: number | null }

// API order kept (oldest first); the last day is today (API contract).
export const toDaySeries = (days: DailyStat[]): DayPoint[] =>
  days.map((d, i) => ({
    ...d,
    ...dayTick(d.date),
    today: i === days.length - 1,
    pct: d.correctionRate === null ? null : d.correctionRate * 100,
  }))

export const total = (points: DayPoint[], key: 'detections' | 'pipesActual') => points.reduce((a, p) => a + p[key], 0)

// 0-1 rate -> "25%"; null (nothing confirmed) -> "—".
export const formatPct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`)

export type MvaRow = {
  key: string
  label: string
  model: number
  actual: number
  diff: number
  diffLabel: string
  range: [number, number]
}

// Confirmed batches -> rows oldest -> newest. Rows without an actual amount are skipped.
export function toModelVsActual(records: RecordRow[]): MvaRow[] {
  const at = (r: RecordRow) => r.confirmedAt ?? r.createdAt
  return records
    .filter((r): r is RecordRow & { actualAmount: number } => r.actualAmount !== null)
    .sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0))
    .map((r) => {
      const diff = r.actualAmount - r.modelTotal
      return {
        key: r.batchId,
        label: r.doNumber ?? r.batchId.slice(0, 8),
        model: r.modelTotal,
        actual: r.actualAmount,
        diff,
        diffLabel: formatVariance(diff),
        range: [Math.min(r.modelTotal, r.actualAmount), Math.max(r.modelTotal, r.actualAmount)],
      }
    })
}

// Value axis for model vs actual: 5 of padding, snapped to steps of 20, never below 0.
export function valueDomain(rows: MvaRow[]): [number, number] {
  const all = rows.flatMap((r) => [r.model, r.actual])
  return [Math.max(0, Math.floor((Math.min(...all) - 5) / 20) * 20), Math.ceil((Math.max(...all) + 5) / 20) * 20]
}
