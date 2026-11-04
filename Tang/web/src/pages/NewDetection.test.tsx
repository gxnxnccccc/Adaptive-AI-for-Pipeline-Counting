import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, renderAnnotatedPng } from '@/lib/annotate'
import { confirmBatch, getCountsTotal, getHealth, getStats, uploadImages, type RecordRow } from '@/lib/api'
import type { CountsResponse } from '@/lib/detection'
import App from '@/App'

vi.mock('@/lib/api', () => ({
  uploadImages: vi.fn(),
  getHealth: vi.fn(),
  getCountsTotal: vi.fn(),
  confirmBatch: vi.fn(),
  getStats: vi.fn(),
}))
vi.mock('@/lib/annotate', async (orig) => ({
  ...(await orig<typeof import('@/lib/annotate')>()),
  renderAnnotatedPng: vi.fn(),
  downloadBlob: vi.fn(),
}))
const mockUpload = vi.mocked(uploadImages)

const img = (n: number, count: number, confs: number[]) => ({
  image_id: `img_${n}`,
  filename: `p${n}.png`,
  count,
  crop_box: null,
  pipes: confs.map((c, i) => ({ box: [i * 10, 0, 8, 8], confidence: c })),
  quality: { brightness: n === 2 ? 'dark' : 'ok' },
  original_bytes: 1,
  error: null,
})
const resp: CountsResponse = { batch_id: 'b1', images: [img(1, 42, [0.9, 0.2]), img(2, 17, [0.8])] }

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('spds.operator', 'OP-7')
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:fake-${n++}`)
  URL.revokeObjectURL = vi.fn()
  vi.mocked(getHealth).mockResolvedValue(true)
  vi.mocked(getCountsTotal).mockResolvedValue(0)
  vi.mocked(getStats).mockResolvedValue({ detectionsToday: 0, confirmedTotal: 0, correctionRate: null, failedImagesToday: 0 })
  vi.mocked(confirmBatch).mockReset()
  mockUpload.mockReset().mockResolvedValue(resp)
  vi.mocked(renderAnnotatedPng).mockReset().mockResolvedValue(new Blob(['png']))
  vi.mocked(downloadBlob).mockReset()
})

async function reachStep2() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/new']}>
      <App />
    </MemoryRouter>,
  )
  const files = [new File(['a'], 'p1.png', { type: 'image/png' }), new File(['b'], 'p2.png', { type: 'image/png' })]
  await user.upload(screen.getByLabelText(/เลือกรูป/), files)
  await user.click(screen.getByRole('button', { name: /อัปโหลด 2/ }))
  await screen.findByTestId('total-count')
  return { user, files }
}

describe('New Detection steps 1-2', () => {
  it('sends the operator id and shows total = sum of both photos, stepper on step 2', async () => {
    await reachStep2()
    expect(mockUpload.mock.calls[0][1]).toBe('OP-7')
    expect(screen.getByTestId('total-count')).toHaveTextContent('59')
    expect(screen.getAllByTestId('result-card')).toHaveLength(2)
    expect(screen.getByTestId('stepper').querySelector('[aria-current="step"]')).toHaveTextContent(/Detection/)
  })

  it('shows mean confidence and the dark warning', async () => {
    await reachStep2()
    // (0.9 + 0.2 + 0.8) / 3 = 63%
    expect(screen.getByTestId('mean-confidence')).toHaveTextContent('63%')
    expect(screen.getAllByText(/มืดเกินไป/)).toHaveLength(1)
  })

  it('remove drops the photo and updates the total', async () => {
    const { user } = await reachStep2()
    const card = screen.getAllByTestId('result-card')[0]
    await user.click(within(card).getByRole('button', { name: /Remove/ }))
    expect(screen.getAllByTestId('result-card')).toHaveLength(1)
    expect(screen.getByTestId('total-count')).toHaveTextContent('17')
  })

  it('flags a low-confidence box with its own class', async () => {
    await reachStep2()
    const card = screen.getAllByTestId('result-card')[0]
    const photo = card.querySelector('img') as HTMLImageElement
    Object.defineProperty(photo, 'naturalWidth', { value: 100 })
    Object.defineProperty(photo, 'naturalHeight', { value: 100 })
    fireEvent.load(photo)
    expect(card.querySelectorAll('.box-ok')).toHaveLength(1)
    expect(card.querySelectorAll('.box-low')).toHaveLength(1)
  })

  it('save original and save result download files', async () => {
    const { user, files } = await reachStep2()
    const card = screen.getAllByTestId('result-card')[0]
    await user.click(within(card).getByRole('button', { name: /Save Original/ }))
    expect(downloadBlob).toHaveBeenCalledWith(files[0], 'p1.png')
    await user.click(within(card).getByRole('button', { name: /Save Detection Result/ }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))
    expect(vi.mocked(renderAnnotatedPng).mock.calls[0][0]).toBe(files[0])
    expect(vi.mocked(downloadBlob).mock.calls[1][1]).toBe('p1-detected.png')
  })

  it('continue moves the stepper to step 3', async () => {
    const { user } = await reachStep2()
    await user.click(screen.getByRole('button', { name: /Continue to confirm/ }))
    expect(screen.getByTestId('stepper').querySelector('[aria-current="step"]')).toHaveTextContent(/Confirm/)
  })
})

const saved: RecordRow = {
  batchId: 'abcdef12-0000', createdAt: '2026-11-04T03:00:00Z', operatorId: 'OP-7', doNumber: 'DX1', imageCount: 2,
  modelTotal: 17, actualAmount: 20, variance: 3, status: 'confirmed', flagged: true, notes: 'two hidden', confirmedAt: '2026-11-04T03:05:00Z',
}

async function reachStep3(removeFirst = false) {
  const ctx = await reachStep2()
  if (removeFirst) await ctx.user.click(within(screen.getAllByTestId('result-card')[0]).getByRole('button', { name: /Remove/ }))
  await ctx.user.click(screen.getByRole('button', { name: /Continue to confirm/ }))
  return ctx
}
const submitBtn = () => screen.getByRole('button', { name: /Submit Detection|Submitting/ })

describe('New Detection step 3 + success', () => {
  it('submit is disabled until DO and notes are valid; actual defaults to the model total', async () => {
    const { user } = await reachStep3()
    expect(screen.getByLabelText(/Actual Amount/)).toHaveValue('59')
    expect(submitBtn()).toBeDisabled()
    await user.type(screen.getByLabelText(/DO Number/), 'DX1')
    expect(submitBtn()).toBeDisabled()
    await user.type(screen.getByLabelText(/Notes/), 'ok')
    expect(submitBtn()).toBeEnabled()
    await user.clear(screen.getByLabelText(/Actual Amount/))
    expect(submitBtn()).toBeDisabled()
    await user.type(screen.getByLabelText(/Actual Amount/), '-2')
    expect(submitBtn()).toBeDisabled()
  })

  it('shows the variance badge', async () => {
    const { user } = await reachStep3()
    const actual = screen.getByLabelText(/Actual Amount/)
    await user.clear(actual)
    await user.type(actual, '62')
    expect(screen.getByTestId('variance')).toHaveTextContent('+3 vs model')
    await user.clear(actual)
    await user.type(actual, '50')
    expect(screen.getByTestId('variance')).toHaveTextContent('-9 vs model')
  })

  it('sends the kept image ids (a removed photo is left out) and shows the summary', async () => {
    vi.mocked(confirmBatch).mockResolvedValue(saved)
    const { user } = await reachStep3(true) // img_1 removed, img_2 kept (17 pipes)
    await user.type(screen.getByLabelText(/DO Number/), ' DX1 ')
    await user.type(screen.getByLabelText(/Notes/), 'two hidden')
    const actual = screen.getByLabelText(/Actual Amount/)
    await user.clear(actual)
    await user.type(actual, '20')
    await user.click(submitBtn())
    expect(confirmBatch).toHaveBeenCalledWith('b1', { doNumber: 'DX1', actualAmount: 20, notes: 'two hidden', imageIds: ['img_2'] })
    expect(await screen.findByTestId('summary')).toBeInTheDocument()
    expect(screen.getByTestId('summary-do')).toHaveTextContent('DX1')
    expect(screen.getByTestId('summary-actual')).toHaveTextContent('20')
    expect(screen.getByTestId('summary-detected')).toHaveTextContent('17')
    expect(screen.getByTestId('summary-confidence')).toHaveTextContent('80%')
    expect(screen.getByTestId('summary-variance')).toHaveTextContent('+3')
    expect(screen.getByTestId('summary-notes')).toHaveTextContent('two hidden')
    expect(screen.getByTestId('summary-id')).toHaveTextContent('ABCDEF12')
  })

  it('View Dashboard navigates; Start New Detection returns to step 1', async () => {
    vi.mocked(confirmBatch).mockResolvedValue(saved)
    const { user } = await reachStep3()
    await user.type(screen.getByLabelText(/DO Number/), 'DX1')
    await user.type(screen.getByLabelText(/Notes/), 'n')
    await user.click(submitBtn())
    await user.click(await screen.findByRole('button', { name: /Start New Detection/ }))
    expect(screen.getByRole('heading', { name: /ถ่าย \/ อัปโหลดรูป/ })).toBeInTheDocument()
  })

  it('View Dashboard goes to the dashboard page', async () => {
    vi.mocked(confirmBatch).mockResolvedValue(saved)
    const { user } = await reachStep3()
    await user.type(screen.getByLabelText(/DO Number/), 'DX1')
    await user.type(screen.getByLabelText(/Notes/), 'n')
    await user.click(submitBtn())
    await user.click(await screen.findByRole('button', { name: /View Dashboard/ }))
    expect(await screen.findByTestId('kpi-today')).toBeInTheDocument()
  })

  it('keeps the form and shows the API error on failure; blocks double submit', async () => {
    let reject!: (e: Error) => void
    vi.mocked(confirmBatch).mockReturnValue(new Promise((_, r) => (reject = r)))
    const { user } = await reachStep3()
    await user.type(screen.getByLabelText(/DO Number/), 'DX1')
    await user.type(screen.getByLabelText(/Notes/), 'keep me')
    await user.click(submitBtn())
    expect(submitBtn()).toBeDisabled()
    await user.click(submitBtn())
    expect(confirmBatch).toHaveBeenCalledTimes(1)
    reject(new Error('database not configured: set SUPABASE_URL'))
    expect(await screen.findByTestId('submit-error')).toHaveTextContent('database not configured')
    expect(screen.getByLabelText(/Notes/)).toHaveValue('keep me')
    expect(screen.getByLabelText(/DO Number/)).toHaveValue('DX1')
    expect(submitBtn()).toBeEnabled()
  })

  it('cancel asks first, then resets the flow to step 1', async () => {
    const { user } = await reachStep3()
    await user.click(screen.getByRole('button', { name: /^ยกเลิก/ }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ไม่ ทำต่อ/ }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^ยกเลิก/ }))
    await user.click(screen.getByRole('button', { name: /ใช่ ยกเลิก/ }))
    expect(screen.getByRole('heading', { name: /ถ่าย \/ อัปโหลดรูป/ })).toBeInTheDocument()
    expect(screen.getByTestId('stepper').querySelector('[aria-current="step"]')).toHaveTextContent(/Capture/)
  })
})
