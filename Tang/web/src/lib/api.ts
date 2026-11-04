import type { components } from './api-types'
import type { CountsResponse } from './detection'

const base = () => import.meta.env.VITE_API_URL

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

  const res = await fetch(`${base()}/api/counts`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
  }
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

export const EXPORT_CAP = 1000

// Every row of the current filter + search (pages of 100), at most `cap` rows.
export async function listAllRecords(query: RecordsQuery, cap = EXPORT_CAP): Promise<RecordRow[]> {
  const out: RecordRow[] = []
  for (;;) {
    const page = await listRecords({ ...query, limit: 100, offset: out.length })
    out.push(...page.items)
    if (page.items.length === 0 || out.length >= page.total || out.length >= cap) return out.slice(0, cap)
  }
}

// Tab counts: one limit=1 request per filter and read `total` (the API has no group-by).
export async function getRecordCounts(q: string): Promise<Record<RecordFilter, number>> {
  const filters: RecordFilter[] = ['all', 'confirmed', 'draft', 'flagged']
  const pages = await Promise.all(filters.map((filter) => listRecords({ filter, q, limit: 1 })))
  return Object.fromEntries(filters.map((f, i) => [f, pages[i].total])) as Record<RecordFilter, number>
}

// Total number of records (for the sidebar badge). Throws when the API errors.
export async function getCountsTotal(): Promise<number> {
  const res = await fetch(`${base()}/api/counts?limit=1`)
  if (!res.ok) throw new Error(`Records failed: ${res.status}`)
  return ((await res.json()) as Schemas['RecordsResponse']).total
}

// ---- Confirm ----

export type ConfirmInput = { doNumber: string; actualAmount: number; notes: string; imageIds: string[] }

export async function confirmBatch(batchId: string, input: ConfirmInput): Promise<RecordRow> {
  const body: Schemas['ConfirmRequest'] = {
    do_number: input.doNumber.trim(),
    actual_amount: input.actualAmount,
    notes: input.notes.trim(),
    image_ids: input.imageIds,
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
