import type { RecordRow } from './api'

// One CSV cell: quote when it holds a comma, quote, CR or LF; double the quotes.
export function escapeCsv(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Free text from users: stop Excel running it as a formula (=, +, -, @ at the start).
const safeText = (s: string | null) => (s && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s)

export const toCsv = (rows: (string | number | null)[][]) => rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n')

const HEADER = ['Time', 'DO Number', 'Operator', 'Photos', 'Detected', 'Actual', 'Variance', 'Status']

export function recordsToCsv(records: RecordRow[]): string {
  return toCsv([
    HEADER,
    ...records.map((r) => [
      r.createdAt,
      safeText(r.doNumber),
      safeText(r.operatorId),
      r.imageCount,
      r.modelTotal,
      r.actualAmount,
      r.variance,
      r.flagged ? 'flagged' : r.status,
    ]),
  ])
}

// UTF-8 BOM so Excel shows Thai text correctly.
export const withBom = (csv: string) => String.fromCharCode(0xfeff) + csv
