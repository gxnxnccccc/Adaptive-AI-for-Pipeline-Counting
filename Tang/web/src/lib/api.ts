import type { components } from './api-types'
import type { CountsResponse } from './detection'
import { bi, t } from './i18n'

const base = () => import.meta.env.VITE_API_URL ?? '' // '' = same origin (nginx proxy in Docker)

type Schemas = components['schemas']

// Error text from the API ({"detail": "..."} or a FastAPI 422 list), else the status line.
async function errorText(res: Response, what: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) return body.detail.map((d: { msg?: string }) => d.msg ?? '').join('; ')
  } catch {
    /* not JSON */
  }
  return `${what} failed: ${res.status} ${res.statusText}`.trim()
}

// Returns the raw typed response; map it with toDetectedImages() from detection.ts.
export async function uploadImages(files: File[], operatorId = 'unknown'): Promise<CountsResponse> {
  const form = new FormData()
  for (const f of files) form.append('images', f)
  form.append('operator_id', operatorId)

  let res: Response
  try {
    res = await fetch(`${base()}/api/counts`, { method: 'POST', body: form })
  } catch (e) {
    // fetch rejects with a TypeError when the API can't be reached (down, wrong URL, CORS).
    if (e instanceof TypeError) throw new Error(bi(t.apiDownTitle), { cause: e })
    throw e
  }
  if (!res.ok) throw new Error(await errorText(res, 'Upload'))
  return (await res.json()) as CountsResponse
}

// true when the API answers /health with 2xx; never throws.
export async function getHealth(): Promise<boolean> {
  try {
    return (await fetch(`${base()}/health`)).ok
  } catch {
    return false
  }
}

// ---- Records (adapter: the pages only see RecordRow, never the raw schema) ----

export type RecordRow = {
  batchId: string
  createdAt: string
  operatorId: string
  doNumber: string | null
  imageCount: number
  modelTotal: number
  actualAmount: number | null
  variance: number | null
  status: 'draft' | 'confirmed'
  flagged: boolean
  notes: string | null
  confirmedAt: string | null
}
export type RecordsPage = { items: RecordRow[]; total: number }
export type RecordFilter = 'all' | 'confirmed' | 'draft' | 'flagged'

const toRecord = (r: Schemas['BatchRecord']): RecordRow => ({
  batchId: r.batch_id,
  createdAt: r.created_at,
  operatorId: r.operator_id,
  doNumber: r.do_number ?? null,
  imageCount: r.image_count,
  modelTotal: r.model_total,
  actualAmount: r.actual_amount ?? null,
  variance: r.variance ?? null,
  status: r.status,
  flagged: r.flagged,
  notes: r.notes ?? null,
  confirmedAt: r.confirmed_at ?? null,
})

export type RecordsQuery = { filter?: RecordFilter; q?: string; limit?: number; offset?: number }

// Query string for GET /api/counts. 'all' and an empty search are left out.
export function buildRecordsQuery({ filter = 'all', q = '', limit = 20, offset = 0 }: RecordsQuery): string {
  const p = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (filter !== 'all') p.set('status', filter)
  if (q.trim()) p.set('q', q.trim())
  return p.toString()
}

export async function listRecords(query: RecordsQuery): Promise<RecordsPage> {
  const res = await fetch(`${base()}/api/counts?${buildRecordsQuery(query)}`)
  if (!res.ok) throw new Error(await errorText(res, 'Records'))
  const body = (await res.json()) as Schemas['RecordsResponse']
  return { items: body.items.map(toRecord), total: body.total }
}

// ---- Confirm ----

// corrections: per-box edits of the kept photos (from toCorrections() in corrections.ts); [] = none.
export type ConfirmInput = {
  doNumber: string
  actualAmount: number
  notes: string
  imageIds: string[]
  corrections: Schemas['ImageCorrection'][]
}

export async function confirmBatch(batchId: string, input: ConfirmInput): Promise<RecordRow> {
  const body: Schemas['ConfirmRequest'] = {
    do_number: input.doNumber.trim(),
    actual_amount: input.actualAmount,
    notes: input.notes.trim(),
    image_ids: input.imageIds,
    corrections: input.corrections,
  }
  const res = await fetch(`${base()}/api/counts/${encodeURIComponent(batchId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorText(res, 'Submit'))
  return toRecord((await res.json()) as Schemas['BatchRecord'])
}

// ---- Stats ----

export type Stats = {
  detectionsToday: number
  confirmedTotal: number
  correctionRate: number | null
  failedImagesToday: number
}

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${base()}/api/stats`)
  if (!res.ok) throw new Error(await errorText(res, 'Stats'))
  const s = (await res.json()) as Schemas['StatsResponse']
  return {
    detectionsToday: s.detections_today,
    confirmedTotal: s.confirmed_total,
    correctionRate: s.correction_rate ?? null,
    failedImagesToday: s.failed_images_today,
  }
}

// One Bangkok calendar day (GET /api/stats/daily). `date` is a plain YYYY-MM-DD, never parse it as UTC.
export type DailyStat = {
  date: string
  detections: number
  pipesActual: number
  confirmed: number
  corrected: number
  correctionRate: number | null
}

// `days` entries, oldest first, last = today (zero-filled by the API).
export async function getDailyStats(days = 7): Promise<DailyStat[]> {
  const res = await fetch(`${base()}/api/stats/daily?days=${days}`)
  if (!res.ok) throw new Error(await errorText(res, 'Daily stats'))
  const body = (await res.json()) as Schemas['DailyStatsResponse']
  return body.days.map((d) => ({
    date: d.date,
    detections: d.detections,
    pipesActual: d.pipes_actual,
    confirmed: d.confirmed,
    corrected: d.corrected,
    correctionRate: d.correction_rate ?? null,
  }))
}
