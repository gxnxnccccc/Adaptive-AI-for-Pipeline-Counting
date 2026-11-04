import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { getStats, type Stats } from '@/lib/api'
import { bi, t } from '@/lib/i18n'

type Result = { n: number; stats?: Stats; error?: string; at: Date }

export const ratePct = (r: number | null) => (r === null ? '-' : `${Math.round(r * 100)}%`)
const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

export default function Dashboard() {
  const [n, setN] = useState(0) // bump to refetch
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let alive = true
    getStats().then(
      (stats) => alive && setResult({ n, stats, at: new Date() }),
      (e: unknown) => alive && setResult({ n, error: e instanceof Error ? e.message : String(e), at: new Date() }),
    )
    return () => {
      alive = false
    }
  }, [n])

  const loading = result?.n !== n
  const s = result?.stats
  const empty = !!s && s.detectionsToday === 0 && s.confirmedTotal === 0 && s.failedImagesToday === 0

  const cards = s && [
    ['today', t.kpiToday, String(s.detectionsToday)],
    ['confirmed', t.kpiConfirmed, String(s.confirmedTotal)],
    ['correction', t.kpiCorrection, ratePct(s.correctionRate)],
    ['failed', t.kpiFailed, String(s.failedImagesToday)],
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-800">{bi(t.navDashboard)}</h2>
        <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
          <Link to="/new">{bi(t.navNew)}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
        {result && !loading && <span data-testid="updated-at">{bi(t.updatedAt(hhmm(result.at)))}</span>}
        <Button variant="outline" size="sm" disabled={loading} onClick={() => setN((x) => x + 1)}>
          {bi(t.refresh)}
        </Button>
      </div>

      {loading && <p className="text-gray-600">{bi(t.loading)}</p>}
      {!loading && result?.error && (
        <p role="alert" data-testid="dashboard-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          {result.error}
        </p>
      )}
      {!loading && cards && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {cards.map(([key, label, value]) => (
              <div key={key} data-testid={`kpi-${key}`} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="text-sm text-gray-700">{bi(label)}</div>
                <div data-testid={`kpi-${key}-value`} className="text-3xl font-bold text-blue-700">
                  {value}
                </div>
              </div>
            ))}
          </div>
          {empty && <p className="text-gray-700">{bi(t.dashEmpty)}</p>}
        </>
      )}
    </div>
  )
}
