import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

// The real lib/api runs; only the network is faked (API field names on the wire).
const wire = (detections: number, confirmed: number, rate: number | null, failed: number) => ({
  detections_today: detections,
  confirmed_total: confirmed,
  correction_rate: rate,
  failed_images_today: failed,
})
const rec = (id: string, over: Record<string, unknown> = {}) => ({
  batch_id: id,
  created_at: new Date().toISOString(),
  operator_id: 'OP-07',
  do_number: null,
  image_count: 2,
  model_total: 120,
  actual_amount: null,
  variance: null,
  status: 'draft',
  flagged: false,
  notes: null,
  confirmed_at: null,
  ...over,
})
// confirmed (match), confirmed + flagged (+2), draft
const THREE = [
  rec('b1', { do_number: 'DX1', actual_amount: 120, variance: 0, status: 'confirmed' }),
  rec('b2', { do_number: 'DX2', actual_amount: 122, variance: 2, status: 'confirmed', flagged: true }),
  rec('b3'),
]
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

type Api = { stats?: unknown; items?: unknown[]; status?: number; daily?: unknown[]; confirmed?: unknown[]; chartsStatus?: number }
// Answers /api/stats, /api/stats/daily and /api/counts from `api` (read on every call, so tests can change it).
const stubApi = (api: Api) => {
  const f = vi.fn((url: string) => {
    const u = String(url)
    if (api.status) return reply({ detail: 'database not configured: set SUPABASE_URL' }, api.status)
    if (api.chartsStatus && (u.includes('/api/stats/daily') || u.includes('status=confirmed')))
      return reply({ detail: 'daily stats failed: boom' }, api.chartsStatus)
    if (u.includes('/api/stats/daily')) return reply({ days: api.daily ?? [] })
    if (u.includes('/api/stats')) return reply(api.stats)
    const items = u.includes('status=confirmed') ? (api.confirmed ?? []) : (api.items ?? [])
    return reply({ items, total: items.length })
  })
  vi.stubGlobal('fetch', f)
  return f
}

// GET /api/stats/daily?days=7 wire shape: oldest first, last = today; 08/11 has nothing confirmed.
const day = (date: string, detections: number, pipes: number, confirmed: number, corrected: number) => ({
  date,
  detections,
  pipes_actual: pipes,
  confirmed,
  corrected,
  correction_rate: confirmed ? Math.round((corrected / confirmed) * 10000) / 10000 : null,
})
const WEEK = [
  day('2026-11-03', 7, 612, 3, 1),
  day('2026-11-04', 10, 845, 5, 1),
  day('2026-11-05', 8, 702, 7, 2),
  day('2026-11-06', 11, 930, 9, 2),
  day('2026-11-07', 4, 310, 4, 1),
  day('2026-11-08', 0, 0, 0, 0),
  day('2026-11-09', 12, 796, 8, 3),
]
// 10 confirmed, newest first (API order): DX10 .. DX1; DX10 is +2, DX9 is -1, the rest match.
const CONF10 = Array.from({ length: 10 }, (_, i) => {
  const n = 10 - i
  const model = 80 + n
  const actual = n === 10 ? model + 2 : n === 9 ? model - 1 : model
  return rec(`c${n}`, {
    do_number: `DX${n}`,
    model_total: model,
    actual_amount: actual,
    variance: actual - model,
    status: 'confirmed',
    flagged: actual !== model,
    confirmed_at: `2026-11-09T${String(n).padStart(2, '0')}:00:00Z`,
  })
})
const cells = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))

const renderIt = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )

afterEach(() => vi.unstubAllGlobals())

describe('Dashboard', () => {
  it('loaded: 4 KPI values, rate as a percent, updated time, Recent 10 rows', async () => {
    const f = stubApi({ stats: wire(12, 40, 0.256, 1), items: THREE })
    renderIt()
    expect(await screen.findByTestId('kpi-today-value')).toHaveTextContent('12')
    expect(screen.getByTestId('kpi-confirmed-value')).toHaveTextContent('40')
    expect(screen.getByTestId('kpi-correction-value')).toHaveTextContent('26%')
    expect(screen.getByTestId('kpi-failed-value')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-failed-icon')).toHaveAttribute('data-alarm', 'true')
    expect(screen.getByTestId('updated-at')).toHaveTextContent(/Updated \d\d:\d\d/)
    expect(screen.getAllByTestId('recent-row')).toHaveLength(3)
    expect(screen.queryByTestId('dashboard-empty')).not.toBeInTheDocument()
    expect(f.mock.calls.some(([u]) => String(u).includes('/api/counts?limit=10&offset=0'))).toBe(true)
  })

  it('Recent rows: status chips, signed variance, draft shows dashes', async () => {
    stubApi({ stats: wire(3, 2, 0.5, 0), items: THREE })
    renderIt()
    const rows = await screen.findAllByTestId('recent-row')
    const chips = rows.map((r) => within(r).getByTestId('status-chip').textContent)
    expect(chips).toEqual(['ยืนยันแล้วConfirmed', 'ต้องตรวจสอบFlagged', 'ฉบับร่างDraft'])
    const variance = rows.map((r) => within(r).getByTestId('recent-variance').textContent)
    expect(variance[0]).toMatch(/Variance0$/)
    expect(variance[1]).toMatch(/Variance\+2$/)
    expect(variance[2]).toMatch(/Variance—$/)
    expect(within(rows[0]).getByTestId('recent-do')).toHaveTextContent('DX1')
    expect(within(rows[2]).getByTestId('recent-do')).toHaveTextContent('—')
    expect(screen.getByTestId('kpi-failed-icon')).not.toHaveAttribute('data-alarm')
  })

  it('negative variance keeps its sign', async () => {
    stubApi({ stats: wire(1, 1, 1, 0), items: [rec('b9', { do_number: 'DX9', actual_amount: 87, variance: -1, status: 'confirmed', flagged: true })] })
    renderIt()
    const row = await screen.findByTestId('recent-row')
    expect(within(row).getByTestId('recent-variance')).toHaveTextContent(/Variance-1$/)
  })

  it('empty: KPIs 0 / 0 / — / 0, empty card with New detection, "No records yet"', async () => {
    stubApi({ stats: wire(0, 0, null, 0), items: [] })
    renderIt()
    expect(await screen.findByTestId('dashboard-empty')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-today-value')).toHaveTextContent('0')
    expect(screen.getByTestId('kpi-confirmed-value')).toHaveTextContent('0')
    expect(screen.getByTestId('kpi-correction-value')).toHaveTextContent('—')
    expect(screen.getByTestId('kpi-failed-value')).toHaveTextContent('0')
    expect(screen.getByText(/Nothing confirmed yet/)).toBeInTheDocument()
    expect(screen.getByText(/No records yet/)).toBeInTheDocument()
    expect(screen.queryAllByTestId('recent-row')).toHaveLength(0)
    const links = screen.getAllByRole('link', { name: /New detection/ })
    expect(links.length).toBe(2)
    links.forEach((l) => expect(l).toHaveAttribute('href', '/processing'))
  })

  it('loading: skeletons, Refresh disabled, no values', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderIt()
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeDisabled()
    expect(screen.getByTestId('recent-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('kpi-today-value')).not.toBeInTheDocument()
    expect(screen.getByTestId('updated-at')).toHaveTextContent('Loading')
  })

  it('API error: alert with the detail, KPIs "—", Recent hidden; Retry refetches', async () => {
    const user = userEvent.setup()
    const api: Api = { status: 503 }
    const f = stubApi(api)
    renderIt()
    expect(await screen.findByTestId('dashboard-error')).toHaveTextContent('database not configured')
    expect(screen.getByTestId('kpi-today-value')).toHaveTextContent('—')
    expect(screen.getByTestId('kpi-correction-value')).toHaveTextContent('—')
    expect(screen.queryByText(/Recent 10/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-charts')).not.toBeInTheDocument()
    expect(screen.getByTestId('updated-at')).toHaveTextContent('Not updated')

    const calls = f.mock.calls.length
    Object.assign(api, { status: undefined, stats: wire(4, 1, 0, 0), items: THREE })
    await user.click(screen.getByRole('button', { name: /Retry/ }))
    await waitFor(() => expect(screen.getByTestId('kpi-today-value')).toHaveTextContent('4'))
    expect(f.mock.calls.length).toBeGreaterThan(calls)
    expect(screen.queryByTestId('dashboard-error')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('recent-row')).toHaveLength(3)
  })

  it("network failure shows the can't-reach-API text", async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderIt()
    expect(await screen.findByTestId('dashboard-error')).toHaveTextContent("Can't reach the API")
  })

  it('Refresh fetches again; New detection links to /processing', async () => {
    const user = userEvent.setup()
    const api: Api = { stats: wire(1, 1, 0, 0), items: THREE }
    const f = stubApi(api)
    renderIt()
    await screen.findByTestId('kpi-today-value')
    const calls = f.mock.calls.length
    api.stats = wire(5, 1, 0, 0)
    await user.click(screen.getByRole('button', { name: /Refresh/ }))
    await waitFor(() => expect(screen.getByTestId('kpi-today-value')).toHaveTextContent('5'))
    expect(f.mock.calls.length).toBe(calls * 2)
    expect(screen.getByRole('link', { name: /New detection/ })).toHaveAttribute('href', '/processing')
  })

  describe('charts (10b)', () => {
    it('4 chart titles; each "View as table" has the exact numbers (7 / 7 / 7 / 10 rows)', async () => {
      const f = stubApi({ stats: wire(12, 40, 0.25, 0), items: THREE, daily: WEEK, confirmed: CONF10 })
      renderIt()
      const charts = await screen.findByTestId('dashboard-charts')
      for (const title of [/Detections per day/, /Pipes counted per day/, /Correction rate trend/, /Model vs actual/])
        expect(await within(charts).findByRole('heading', { name: title })).toBeInTheDocument()
      expect(f.mock.calls.some(([u]) => String(u).includes('/api/stats/daily?days=7'))).toBe(true)
      expect(f.mock.calls.some(([u]) => String(u).includes('/api/counts?limit=10&offset=0&status=confirmed'))).toBe(true)

      const det = cells(await screen.findByTestId('table-detections'))
      expect(det).toHaveLength(7)
      expect(det[0]).toEqual(['2026-11-03', '7'])
      expect(det[6]).toEqual(['2026-11-09', '12'])
      expect(screen.getByTestId('total-detections')).toHaveTextContent('52')

      const pipes = cells(screen.getByTestId('table-pipes'))
      expect(pipes).toHaveLength(7)
      expect(pipes[3]).toEqual(['2026-11-06', '930'])
      expect(screen.getByTestId('total-pipes')).toHaveTextContent('4,195')

      const rate = cells(screen.getByTestId('table-rate'))
      expect(rate).toHaveLength(7)
      expect(rate[1]).toEqual(['2026-11-04', '20%', '5'])
      expect(rate[5]).toEqual(['2026-11-08', '—', '0']) // null stays a gap, not 0 %
      expect(rate[6]).toEqual(['2026-11-09', '38%', '8'])

      const mva = cells(screen.getByTestId('table-mva'))
      expect(mva).toHaveLength(10)
      expect(mva[0]).toEqual(['DX1', '81', '81', '0']) // oldest first
      expect(mva[8]).toEqual(['DX9', '89', '88', '-1'])
      expect(mva[9]).toEqual(['DX10', '90', '92', '+2'])
    })

    it('"View as table" is a native <details> toggle', async () => {
      const user = userEvent.setup()
      stubApi({ stats: wire(12, 40, 0.25, 0), items: THREE, daily: WEEK, confirmed: CONF10 })
      renderIt()
      const table = await screen.findByTestId('table-detections')
      const details = table.closest('details')!
      expect(details).not.toHaveAttribute('open')
      await user.click(within(details).getByText(/View as table/))
      expect(details).toHaveAttribute('open')
    })

    it('model vs actual with nothing confirmed shows a note, no fake rows', async () => {
      const noneConfirmed = WEEK.map((d) => ({ ...d, confirmed: 0, corrected: 0, correction_rate: null }))
      stubApi({ stats: wire(2, 0, null, 0), items: [rec('d1')], daily: noneConfirmed, confirmed: [] })
      renderIt()
      expect(await screen.findByTestId('mva-empty')).toHaveTextContent('Nothing confirmed yet')
      expect(screen.queryByTestId('table-mva')).not.toBeInTheDocument()
    })

    it('hidden in the empty state, and no chart requests are made', async () => {
      const f = stubApi({ stats: wire(0, 0, null, 0), items: [], daily: WEEK, confirmed: [] })
      renderIt()
      expect(await screen.findByTestId('dashboard-empty')).toBeInTheDocument()
      expect(screen.queryByTestId('dashboard-charts')).not.toBeInTheDocument()
      expect(f.mock.calls.some(([u]) => String(u).includes('/api/stats/daily') || String(u).includes('status=confirmed'))).toBe(false)
    })

    it('no chart requests in the API-error state', async () => {
      const f = stubApi({ status: 503 })
      renderIt()
      await screen.findByTestId('dashboard-error')
      expect(f.mock.calls.some(([u]) => String(u).includes('/api/stats/daily') || String(u).includes('status=confirmed'))).toBe(false)
    })

    it('a chart error keeps the KPIs and Recent 10; Retry loads the charts', async () => {
      const user = userEvent.setup()
      const api: Api = { stats: wire(12, 40, 0.25, 1), items: THREE, daily: WEEK, confirmed: CONF10, chartsStatus: 503 }
      stubApi(api)
      renderIt()
      expect(await screen.findByTestId('charts-error')).toHaveTextContent('daily stats failed: boom')
      expect(screen.getByTestId('kpi-today-value')).toHaveTextContent('12')
      expect(screen.getAllByTestId('recent-row')).toHaveLength(3)
      expect(screen.queryByTestId('dashboard-error')).not.toBeInTheDocument()

      api.chartsStatus = undefined
      await user.click(within(screen.getByTestId('charts-error')).getByRole('button', { name: /Retry/ }))
      expect(await screen.findByTestId('table-detections')).toBeInTheDocument()
      expect(screen.queryByTestId('charts-error')).not.toBeInTheDocument()
      expect(screen.getByTestId('kpi-today-value')).toHaveTextContent('12')
    })
  })
})
