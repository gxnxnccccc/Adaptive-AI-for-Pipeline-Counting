import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from '@/lib/annotate'
import { getRecordCounts, listAllRecords, listRecords, type RecordRow } from '@/lib/api'
import Records from './Records'

vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  listRecords: vi.fn(),
  listAllRecords: vi.fn(),
  getRecordCounts: vi.fn(),
}))
vi.mock('@/lib/annotate', () => ({ downloadBlob: vi.fn() }))

const row = (n: number, over: Partial<RecordRow> = {}): RecordRow => ({
  batchId: `b${n}`,
  createdAt: '2026-11-04T03:00:00Z',
  operatorId: 'OP-7',
  doNumber: `DX${n}`,
  imageCount: 2,
  modelTotal: 42,
  actualAmount: 41,
  variance: -1,
  status: 'confirmed',
  flagged: true,
  notes: null,
  confirmedAt: null,
  ...over,
})
const list = vi.mocked(listRecords)
const lastQuery = () => list.mock.calls.at(-1)![0]

beforeEach(() => {
  list.mockReset().mockResolvedValue({ items: [row(1), row(2, { status: 'draft', flagged: false, variance: null, actualAmount: null })], total: 45 })
  vi.mocked(getRecordCounts).mockReset().mockResolvedValue({ all: 45, confirmed: 30, draft: 10, flagged: 5 })
  vi.mocked(listAllRecords).mockReset().mockResolvedValue([row(1)])
  vi.mocked(downloadBlob).mockReset()
})

describe('Records page', () => {
  it('loads page 1 with the table, tab counts and a disabled row arrow', async () => {
    render(<Records />)
    expect(await screen.findAllByTestId('record-row')).toHaveLength(2)
    expect(lastQuery()).toMatchObject({ filter: 'all', q: '', limit: 20, offset: 0 })
    expect(await screen.findByTestId('tab-count-flagged')).toHaveTextContent('(5)')
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('1 / 3')
    expect(screen.getAllByRole('button', { name: /Open details/ })[0]).toBeDisabled()
  })

  it('a filter tab sends status and goes back to page 1', async () => {
    const user = userEvent.setup()
    render(<Records />)
    await screen.findAllByTestId('record-row')
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await waitFor(() => expect(lastQuery().offset).toBe(20))
    await user.click(screen.getByRole('tab', { name: /Flagged/ }))
    await waitFor(() => expect(lastQuery()).toMatchObject({ filter: 'flagged', offset: 0 }))
  })

  it('paging buttons move the offset and stop at the ends', async () => {
    const user = userEvent.setup()
    render(<Records />)
    await screen.findAllByTestId('record-row')
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await waitFor(() => expect(lastQuery().offset).toBe(20))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await waitFor(() => expect(lastQuery().offset).toBe(40))
    await screen.findAllByTestId('record-row')
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Previous/ }))
    await waitFor(() => expect(lastQuery().offset).toBe(20))
  })

  it('search is debounced by 300 ms and sent once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Records />)
      await screen.findAllByTestId('record-row')
      const before = list.mock.calls.length
      await user.type(screen.getByRole('searchbox'), 'DX9')
      expect(list.mock.calls.length).toBe(before) // not yet
      await act(() => vi.advanceTimersByTimeAsync(350))
      await waitFor(() => expect(lastQuery().q).toBe('DX9'))
      expect(list.mock.calls.length).toBe(before + 1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the API message when loading fails, and retry works', async () => {
    const user = userEvent.setup()
    list.mockReset().mockRejectedValueOnce(new Error('database not configured: x')).mockResolvedValue({ items: [], total: 0 })
    render(<Records />)
    expect(await screen.findByTestId('records-error')).toHaveTextContent('database not configured: x')
    await user.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByText(/No records found/)).toBeInTheDocument()
  })

  it('empty state', async () => {
    list.mockResolvedValue({ items: [], total: 0 })
    render(<Records />)
    expect(await screen.findByText(/No records found/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeDisabled()
  })

  it('Export CSV fetches all rows of the current filter and downloads a BOM csv', async () => {
    const user = userEvent.setup()
    render(<Records />)
    await screen.findAllByTestId('record-row')
    await user.click(screen.getByRole('tab', { name: /Confirmed/ }))
    await waitFor(() => expect(lastQuery().filter).toBe('confirmed'))
    await user.click(screen.getByRole('button', { name: /Export CSV/ }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled())
    expect(listAllRecords).toHaveBeenCalledWith({ filter: 'confirmed', q: '' })
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0]
    expect(name).toBe('detection-records.csv')
    expect((blob as Blob).type).toContain('text/csv')
    expect(await (blob as Blob).arrayBuffer().then((b) => Array.from(new Uint8Array(b).slice(0, 3)))).toEqual([0xef, 0xbb, 0xbf])
  })
})
