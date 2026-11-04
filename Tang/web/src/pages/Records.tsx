import { useEffect, useState } from 'react'
import { ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/annotate'
import {
  EXPORT_CAP,
  getRecordCounts,
  listAllRecords,
  listRecords,
  type RecordFilter,
  type RecordRow,
  type RecordsPage,
} from '@/lib/api'
import { formatVariance } from '@/lib/confirm'
import { recordsToCsv, withBom } from '@/lib/csv'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export const PAGE_SIZE = 20
export const SEARCH_DEBOUNCE_MS = 300

const TABS: { filter: RecordFilter; label: Pair }[] = [
  { filter: 'all', label: t.tabAll },
  { filter: 'confirmed', label: t.tabConfirmed },
  { filter: 'draft', label: t.tabDraft },
  { filter: 'flagged', label: t.tabFlagged },
]

type Query = { filter: RecordFilter; q: string; page: number }
type Result = { key: string; data?: RecordsPage; error?: string }

const keyOf = (query: Query, reload: number) => `${query.filter}|${query.q}|${query.page}|${reload}`

function statusLabel(r: RecordRow): Pair {
  if (r.flagged) return t.tabFlagged
  return r.status === 'confirmed' ? t.tabConfirmed : t.tabDraft
}

export default function Records() {
  const [query, setQuery] = useState<Query>({ filter: 'all', q: '', page: 1 })
  const [text, setText] = useState('')
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [counts, setCounts] = useState<Record<RecordFilter, number> | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Search is sent 300 ms after the last keystroke, and goes back to page 1.
  useEffect(() => {
    const id = setTimeout(() => setQuery((p) => (p.q === text.trim() ? p : { ...p, q: text.trim(), page: 1 })), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [text])

  const key = keyOf(query, reload)
  useEffect(() => {
    let alive = true
    listRecords({ filter: query.filter, q: query.q, limit: PAGE_SIZE, offset: (query.page - 1) * PAGE_SIZE }).then(
      (data) => alive && setResult({ key, data }),
      (e: unknown) => alive && setResult({ key, error: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      alive = false
    }
  }, [key, query.filter, query.q, query.page])

  // Tab counts follow the search text; they are skipped (no numbers) if the API errors.
  useEffect(() => {
    let alive = true
    getRecordCounts(query.q).then(
      (c) => alive && setCounts(c),
      () => alive && setCounts(null),
    )
    return () => {
      alive = false
    }
  }, [query.q, reload])

  async function exportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const rows = await listAllRecords({ filter: query.filter, q: query.q })
      downloadBlob(new Blob([withBom(recordsToCsv(rows))], { type: 'text/csv;charset=utf-8' }), 'detection-records.csv')
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  const loading = result?.key !== key
  const data = result?.key === key ? result.data : undefined
  const error = result?.key === key ? result.error : undefined
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-gray-800">{bi(t.navRecords)}</h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          aria-label={bi(t.searchRecords)}
          placeholder={bi(t.searchRecords)}
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base sm:flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button variant="outline" disabled={exporting || !data || data.total === 0} onClick={exportCsv}>
          <Download aria-hidden="true" />
          {bi(exporting ? t.exporting : t.exportCsv)}
        </Button>
      </div>
      {data && data.total > EXPORT_CAP && <p className="text-sm text-gray-600">{bi(t.exportCapped(EXPORT_CAP))}</p>}
      {exportError && (
        <p role="alert" className="text-sm text-red-700">
          {exportError}
        </p>
      )}

      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map(({ filter, label }) => {
          const active = query.filter === filter
          return (
            <button
              key={filter}
              role="tab"
              aria-selected={active}
              className={cn(
                'min-h-11 rounded-lg px-3 text-sm font-medium',
                active ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100',
              )}
              onClick={() => setQuery((p) => ({ ...p, filter, page: 1 }))}
            >
              {bi(label)}
              {counts && <span data-testid={`tab-count-${filter}`}> ({counts[filter]})</span>}
            </button>
          )
        })}
      </div>

      {error && (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          <p data-testid="records-error">{error}</p>
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            {bi(t.retry)}
          </Button>
        </div>
      )}
      {loading && !error && <p className="text-gray-600">{bi(t.loading)}</p>}
      {data && data.items.length === 0 && <p className="text-gray-700">{bi(t.noRecords)}</p>}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-176 text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                {[t.colTime, t.doNumber, t.colOperator, t.colPhotos, t.detected, t.colActual, t.varianceLabel, t.colStatus].map(
                  (h) => (
                    <th key={h.en} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                      {h.th}
                      <div className="font-normal text-gray-600">{h.en}</div>
                    </th>
                  ),
                )}
                <th scope="col" className="w-11" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.batchId} data-testid="record-row" className="border-t border-gray-200">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.doNumber ?? '-'}</td>
                  <td className="px-3 py-2">{r.operatorId}</td>
                  <td className="px-3 py-2">{r.imageCount}</td>
                  <td className="px-3 py-2">{r.modelTotal}</td>
                  <td className="px-3 py-2">{r.actualAmount ?? '-'}</td>
                  <td className="px-3 py-2">{r.variance === null ? '-' : formatVariance(r.variance)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{bi(statusLabel(r))}</td>
                  <td className="px-1">
                    <Button variant="ghost" size="icon" disabled aria-label={bi(t.openDetail)}>
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={query.page <= 1 || loading}
          onClick={() => setQuery((p) => ({ ...p, page: p.page - 1 }))}
        >
          {bi(t.prev)}
        </Button>
        <span data-testid="page-indicator" className="text-sm text-gray-700">
          {bi(t.pageOf(query.page, pages))}
        </span>
        <Button
          variant="outline"
          disabled={query.page >= pages || loading}
          onClick={() => setQuery((p) => ({ ...p, page: p.page + 1 }))}
        >
          {bi(t.next)}
        </Button>
      </div>
    </div>
  )
}
