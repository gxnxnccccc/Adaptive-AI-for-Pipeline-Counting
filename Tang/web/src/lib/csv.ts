import type { RecordRow } from '@/lib/api'

// Records -> CSV for the report (Dashboard "Export CSV"). UTF-8 BOM so Excel shows Thai notes correctly.
export const CSV_HEADER = [
  'batch_id',
  'created_at',
  'operator_id',
  'do_number',
  'status',
  'images',
  'model_total',
  'actual_amount',
  'variance',
  'flagged',
  'confirmed_at',
  'notes',
]

// Quote when needed; text that Excel would run as a formula (= + - @, tab, CR) gets a leading ' (CSV injection).
export function csvCell(v: string | number | boolean | null): string {
  if (v === null) return ''
  if (typeof v !== 'string') return String(v)
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function recordsToCsv(rows: RecordRow[]): string {
  const lines = rows.map((r) =>
    [
      r.batchId,
      r.createdAt,
      r.operatorId,
      r.doNumber,
      r.status,
      r.imageCount,
      r.modelTotal,
      r.actualAmount,
      r.variance,
      r.flagged,
      r.confirmedAt,
      r.notes,
    ]
      .map(csvCell)
      .join(','),
  )
  return '﻿' + [CSV_HEADER.join(','), ...lines].join('\r\n') + '\r\n'
}

// spds-batches-2026-11-16.csv (local date)
export function csvFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `spds-batches-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.csv`
}
