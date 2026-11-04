import { render, screen, waitFor } from '@testing-library/react'
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
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
const stubFetch = (impl: () => Promise<Response>) => {
  const f = vi.fn(impl)
  vi.stubGlobal('fetch', f)
  return f
}

const renderIt = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )

afterEach(() => vi.unstubAllGlobals())

describe('Dashboard', () => {
  it('renders the 4 KPI cards from the API, rate as a percent', async () => {
    stubFetch(() => reply(wire(12, 40, 0.256, 1)))
    renderIt()
    expect(await screen.findByTestId('kpi-today-value')).toHaveTextContent('12')
    expect(screen.getByTestId('kpi-confirmed-value')).toHaveTextContent('40')
    expect(screen.getByTestId('kpi-correction-value')).toHaveTextContent('26%')
    expect(screen.getByTestId('kpi-failed-value')).toHaveTextContent('1')
    expect(screen.getByTestId('updated-at')).toHaveTextContent(/Updated \d\d:\d\d/)
    expect(screen.queryByText(/No data yet/)).not.toBeInTheDocument()
  })

  it('correction rate null shows a dash; all zero shows the empty hint', async () => {
    stubFetch(() => reply(wire(0, 0, null, 0)))
    renderIt()
    expect(await screen.findByTestId('kpi-correction-value')).toHaveTextContent('-')
    expect(screen.getByText(/No data yet/)).toBeInTheDocument()
  })

  it('shows the API error text (503)', async () => {
    stubFetch(() => reply({ detail: 'database not configured: set SUPABASE_URL' }, 503))
    renderIt()
    expect(await screen.findByTestId('dashboard-error')).toHaveTextContent('database not configured')
    expect(screen.queryByTestId('kpi-today')).not.toBeInTheDocument()
  })

  it('Refresh fetches again; New Detection links to /new', async () => {
    const user = userEvent.setup()
    const f = stubFetch(() => reply(wire(1, 1, 0, 0)))
    renderIt()
    await screen.findByTestId('kpi-today')
    f.mockImplementation(() => reply(wire(5, 1, 0, 0)))
    await user.click(screen.getByRole('button', { name: /Refresh/ }))
    await waitFor(() => expect(screen.getByTestId('kpi-today-value')).toHaveTextContent('5'))
    expect(f).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('link', { name: /New Detection/ })).toHaveAttribute('href', '/new')
  })
})
