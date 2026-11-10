import { useEffect } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadImages } from '@/lib/api'
import { AuthProvider } from '@/lib/auth'
import { compressImage } from '@/lib/compress'
import { DetectionSessionProvider, useDetectionSession, type SessionPhoto } from '@/lib/detection-session'
import type { CountsResponse } from '@/lib/detection'
import { checkImageQuality, type Quality } from '@/lib/quality'
import { TOAST_MS } from '@/components/Toast'
import Processing, { REVIEW_DELAY_MS } from './Processing'

vi.mock('@/lib/api', () => ({ uploadImages: vi.fn(), getHealth: vi.fn(() => Promise.resolve(true)) }))
vi.mock('@/lib/quality', async (orig) => ({ ...(await orig<typeof import('@/lib/quality')>()), checkImageQuality: vi.fn() }))
vi.mock('@/lib/compress', async (orig) => ({ ...(await orig<typeof import('@/lib/compress')>()), compressImage: vi.fn() }))
// Camera modal stand-in: one shot, then Done (the real modal is covered in CameraModal.test.tsx).
vi.mock('@/components/CameraModal', () => ({
  canUseLiveCamera: () => true,
  default: ({ onShots }: { onShots: (files: File[]) => void }) => (
    <button type="button" onClick={() => onShots([new File(['j'], 'camera-1700000000000.jpg', { type: 'image/jpeg' })])}>
      fake shot + done
    </button>
  ),
}))

const mockUpload = vi.mocked(uploadImages)
const mockQuality = vi.mocked(checkImageQuality)
const mockCompress = vi.mocked(compressImage)

const MB = 1024 * 1024
const OK: Quality = { brightness: 'ok', blur: 'ok' }

function photo(name: string, bytes = 3 * MB, type = 'image/jpeg') {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}
const photos = (n: number) => Array.from({ length: n }, (_, i) => photo(`IMG_${i + 1}.jpg`))

// Compressed copy: 400 KB, remembered per original so tests can check what was uploaded.
const compressed = new Map<File, File>()
function fakeCompress(file: File) {
  const out = new File(['c'], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  Object.defineProperty(out, 'size', { value: 400 * 1024 })
  compressed.set(file, out)
  return Promise.resolve({ file: out, originalBytes: file.size, compressedBytes: 400 * 1024, width: 800, height: 600 })
}

function img(n: number, count: number, error: string | null = null) {
  return {
    image_id: `img_${n}`,
    filename: `IMG_${n}.jpg`,
    count: error ? null : count,
    crop_box: null,
    pipes: [],
    quality: error ? null : { brightness: 'ok' },
    original_bytes: 1,
    error,
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let session: ReturnType<typeof useDetectionSession>
function ResultProbe() {
  const s = useDetectionSession()
  useEffect(() => {
    session = s
  })
  return <p data-testid="result-page">{s.batchId}</p>
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/processing']}>
      <AuthProvider>
        <DetectionSessionProvider>
          <Routes>
            <Route path="/processing" element={<Processing />} />
            <Route path="/result" element={<ResultProbe />} />
          </Routes>
        </DetectionSessionProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return user
}

const pick = () => screen.getByLabelText(/เลือกรูป/)
const rows = () => (screen.queryByTestId('queue-rows') ? within(screen.getByTestId('queue-rows')).queryAllByRole('listitem') : [])
const cta = () => screen.getByTestId('detect-cta')
const readyRows = () => screen.queryAllByText('พร้อมตรวจ')
const size = (row: HTMLElement) => row.querySelector('[data-size]')

// The done banner waits REVIEW_DELAY_MS before opening /result: fake the clock instead of waiting in real time.
// shouldAdvanceTime keeps user-event and findBy* working. Call after addReady, before clicking Detect.
const fakeClock = () => vi.useFakeTimers({ shouldAdvanceTime: true })
const skipReviewDelay = (extra = 0) => act(async () => void vi.advanceTimersByTime(REVIEW_DELAY_MS + extra))
afterEach(() => vi.useRealTimers())

async function addReady(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  await user.upload(pick(), files)
  await waitFor(() => expect(readyRows()).toHaveLength(files.length))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('spds.operator', 'OP-7')
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:fake-${n++}`)
  URL.revokeObjectURL = vi.fn()
  compressed.clear()
  mockUpload.mockReset()
  mockQuality.mockReset().mockResolvedValue(OK)
  mockCompress.mockReset().mockImplementation(fakeCompress)
})

describe('Processing queue: prepare', () => {
  it('shows the empty state and a disabled Detect button with 0 photos', () => {
    renderPage()
    expect(screen.getByText('ยังไม่มีรูป')).toBeInTheDocument()
    expect(cta()).toBeDisabled()
    expect(screen.getByText(/Add at least 1 photo/)).toBeInTheDocument()
  })

  it('adding 3 files shows 3 rows that reach ready with size lines', async () => {
    const user = renderPage()
    await addReady(user, photos(3))
    expect(rows()).toHaveLength(3)
    for (const r of rows()) expect(size(r)).toHaveTextContent('3.0 MB → 400 KB −87%')
    expect(screen.getByTestId('upload-size')).toHaveTextContent('9.0 MB → 1.2 MB −87%')
    expect(screen.getByTestId('queue-count')).toHaveTextContent('3/10')
    expect(cta()).toBeEnabled()
    expect(cta()).toHaveTextContent('Detect pipes (3)')
  })

  it('prepares one photo at a time: checking -> compressing -> ready', async () => {
    const q = deferred<Quality>()
    const c = deferred<Awaited<ReturnType<typeof compressImage>>>()
    mockQuality.mockReturnValueOnce(q.promise)
    mockCompress.mockReturnValueOnce(c.promise)
    const user = renderPage()
    const [a, b] = photos(2)
    await user.upload(pick(), [a, b])

    const [r1, r2] = rows()
    expect(await within(r1).findByText(/Checking quality/)).toBeInTheDocument()
    expect(size(r1)).toHaveTextContent(/^3\.0 MB$/)
    expect(within(r2).getByText(/Queued/)).toBeInTheDocument()
    expect(cta()).toBeDisabled()
    expect(cta()).toHaveTextContent(/Preparing photos/)

    q.resolve(OK)
    expect(await within(r1).findByText(/Compressing/)).toBeInTheDocument()
    expect(size(r1)).toHaveTextContent('3.0 MB → …')
    expect(screen.getByTestId('upload-size')).toHaveTextContent('6.0 MB → …')
    expect(within(r2).getByText(/Queued/)).toBeInTheDocument()

    c.resolve({ file: new File(['c'], 'IMG_1.jpg'), originalBytes: a.size, compressedBytes: 400 * 1024, width: 800, height: 600 })
    await waitFor(() => expect(readyRows()).toHaveLength(2))
    expect(mockQuality).toHaveBeenCalledTimes(2)
  })

  it('selecting 11 files keeps 10 rows and says why', async () => {
    const user = renderPage()
    await user.upload(pick(), photos(11))
    expect(rows()).toHaveLength(10)
    expect(screen.getByRole('alert')).toHaveTextContent(/Max 10 photos/)
  })

  it('rejects a file over 15 MB and a non-image with clear messages', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderPage()
    await user.upload(pick(), [photo('big.jpg', 16 * MB), photo('notes.txt', 10, 'text/plain'), photo('ok.jpg')])
    expect(rows()).toHaveLength(1)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/big\.jpg is over 15 MB/)
    expect(alert).toHaveTextContent(/notes\.txt is not an image/)
  })

  it('remove drops the row and revokes its thumbnail URL', async () => {
    const user = renderPage()
    await addReady(user, photos(3))
    await user.click(screen.getByRole('button', { name: /Remove IMG_2\.jpg/ }))
    expect(rows()).toHaveLength(2)
    expect(screen.queryByText('IMG_2.jpg')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(cta()).toHaveTextContent('Detect pipes (2)')
  })

  it('a dark and a blurry photo show warning chips with hints but never block Detect', async () => {
    mockQuality.mockResolvedValueOnce(OK).mockResolvedValueOnce({ brightness: 'dark', blur: 'ok' }).mockResolvedValueOnce({ brightness: 'ok', blur: 'blurry' })
    const user = renderPage()
    await addReady(user, photos(3))
    const [, r2, r3] = rows()
    expect(within(r2).getByText('Too dark')).toBeInTheDocument()
    expect(within(r2).getByText(/Add light or use flash/)).toBeInTheDocument()
    expect(within(r3).getByText('Blurry')).toBeInTheDocument()
    expect(cta()).toBeEnabled()
    expect(cta()).toHaveTextContent('Detect pipes (3)')
    expect(screen.getByText(/2 photos have warnings/)).toBeInTheDocument()
  })

  it("a photo that can't be decoded fails and is not uploaded", async () => {
    mockQuality.mockResolvedValueOnce(OK).mockRejectedValueOnce(new Error('decode'))
    mockUpload.mockResolvedValue({ batch_id: 'b1', images: [img(1, 10)] } as CountsResponse)
    const user = renderPage()
    const files = photos(2)
    await user.upload(pick(), files)
    await waitFor(() => expect(readyRows()).toHaveLength(1))
    expect(await within(rows()[1]).findByText(/Can't read this photo/)).toBeInTheDocument()
    expect(cta()).toHaveTextContent('Detect pipes (1)')
    await user.click(cta())
    expect(mockUpload.mock.calls[0][0]).toEqual([compressed.get(files[0])])
  })
})

describe('Processing queue: detect', () => {
  it('while running: shared status on every row, Detect + remove + inputs disabled', async () => {
    mockUpload.mockReturnValue(new Promise(() => {}))
    const user = renderPage()
    await addReady(user, photos(2))
    await user.click(cta())
    expect(screen.getAllByText('กำลังอัปโหลดและตรวจจับ…').length).toBeGreaterThanOrEqual(2)
    expect(cta()).toBeDisabled()
    expect(screen.getByText(/Keep this page open/)).toBeInTheDocument()
    for (const b of screen.getAllByRole('button', { name: /Remove/ })) expect(b).toBeDisabled()
    expect(pick()).toBeDisabled()
    expect(rows()[0].querySelector('[data-scan]')).not.toBeNull()
  })

  it('an API error shows the red banner, keeps the photos ready, and Try again re-sends', async () => {
    mockUpload.mockRejectedValueOnce(new Error('Upload failed: 503 Service Unavailable'))
    const user = renderPage()
    await addReady(user, photos(3))
    await user.click(cta())
    const banner = await screen.findByTestId('upload-error')
    expect(banner).toHaveTextContent(/Your photos are kept/)
    expect(banner).toHaveTextContent(/503/)
    expect(readyRows()).toHaveLength(3)
    expect(cta()).toBeEnabled()
    expect(cta()).toHaveTextContent(/Try again/)

    mockUpload.mockReturnValueOnce(new Promise(() => {}))
    await user.click(cta())
    expect(mockUpload).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('upload-error')).not.toBeInTheDocument()
  })

  it('success: one request with the compressed files, start() with original + upload, then /result', async () => {
    mockUpload.mockResolvedValue({ batch_id: 'b9', images: [img(1, 44), img(2, 40), img(3, 36)] } as CountsResponse)
    const user = renderPage()
    const files = photos(3)
    await addReady(user, files)
    fakeClock()
    await user.click(cta())

    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0][0]).toEqual(files.map((f) => compressed.get(f)))
    expect(mockUpload.mock.calls[0][1]).toBe('OP-7')
    expect(await screen.findByTestId('done-banner')).toHaveTextContent(/3 of 3 photos counted, 120 pipes/)

    // Auto-navigates after REVIEW_DELAY_MS.
    expect(screen.queryByTestId('result-page')).not.toBeInTheDocument()
    await skipReviewDelay()
    expect(screen.getByTestId('result-page')).toHaveTextContent('b9')
    expect(session.photos).toHaveLength(3)
    session.photos.forEach((p, i) => {
      expect(p.original).toBe(files[i])
      expect(p.upload).toBe(compressed.get(files[i]))
      expect(p.originalBytes).toBe(3 * MB)
      expect(p.uploadBytes).toBe(400 * 1024)
      expect(p.quality).toEqual(OK)
      expect(p.result.imageId).toBe(`img_${i + 1}`)
    })
  })

  it('a photo the API failed is shown failed with its reason; Review opens /result', async () => {
    mockUpload.mockResolvedValue({ batch_id: 'b2', images: [img(1, 44), img(2, 0, 'cannot decode image')] } as CountsResponse)
    const user = renderPage()
    await addReady(user, photos(2))
    await user.click(cta())
    const banner = await screen.findByTestId('done-banner')
    expect(banner).toHaveTextContent(/1 of 2 photos counted, 44 pipes/)
    const [r1, r2] = rows()
    expect(within(r1).getByText('44')).toBeInTheDocument()
    expect(within(r2).getByText(/ไม่สำเร็จ/)).toBeInTheDocument()
    expect(within(r2).getByText(/cannot decode image/)).toBeInTheDocument()

    await user.click(within(banner).getByRole('button', { name: /Review/ }))
    expect(screen.getByTestId('result-page')).toHaveTextContent('b2')
    expect(session.photos.map((p) => p.result.error)).toEqual([null, 'cannot decode image'])
  })
})

describe('Processing queue: lifecycle (tester)', () => {
  it('removing a photo mid-prepare does not crash or bring it back; a removed queued photo is skipped', async () => {
    const q = deferred<Quality>()
    mockQuality.mockReturnValueOnce(q.promise)
    const user = renderPage()
    await user.upload(pick(), photos(3))
    const [r1] = rows()
    expect(await within(r1).findByText(/Checking quality/)).toBeInTheDocument()
    // Drop the photo being checked, and a queued one.
    await user.click(screen.getByRole('button', { name: /Remove IMG_1\.jpg/ }))
    await user.click(screen.getByRole('button', { name: /Remove IMG_3\.jpg/ }))
    q.resolve(OK)
    await waitFor(() => expect(readyRows()).toHaveLength(1))
    expect(rows()).toHaveLength(1)
    expect(screen.queryByText('IMG_1.jpg')).not.toBeInTheDocument()
    expect(screen.queryByText('IMG_3.jpg')).not.toBeInTheDocument()
    // IMG_1 (in flight) + IMG_2; IMG_3 never prepared.
    expect(mockQuality).toHaveBeenCalledTimes(2)
    expect(cta()).toHaveTextContent('Detect pipes (1)')
  })

  it('unmount revokes every thumbnail URL', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <MemoryRouter initialEntries={['/processing']}>
        <AuthProvider>
          <DetectionSessionProvider>
            <Processing />
          </DetectionSessionProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
    await addReady(user, photos(3))
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
  })

  it('leaving the page during the 1.5 s done wait does not jump to /result', async () => {
    mockUpload.mockResolvedValue({ batch_id: 'b5', images: [img(1, 7)] } as CountsResponse)
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/processing']}>
        <AuthProvider>
          <DetectionSessionProvider>
            <Link to="/dashboard">go-dash</Link>
            <Routes>
              <Route path="/processing" element={<Processing />} />
              <Route path="/dashboard" element={<p data-testid="dash-page">dash</p>} />
              <Route path="/result" element={<ResultProbe />} />
            </Routes>
          </DetectionSessionProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
    await addReady(user, photos(1))
    fakeClock()
    await user.click(cta())
    await screen.findByTestId('done-banner')
    await user.click(screen.getByText('go-dash'))
    expect(screen.getByTestId('dash-page')).toBeInTheDocument()
    await skipReviewDelay(500)
    expect(screen.getByTestId('dash-page')).toBeInTheDocument()
    expect(screen.queryByTestId('result-page')).not.toBeInTheDocument()
  })
})

describe('Processing queue: camera (6b)', () => {
  it('a camera shot goes through the same add path and reaches ready', async () => {
    const user = renderPage()
    await user.click(screen.getByRole('button', { name: /Open camera/ }))
    await user.click(screen.getByRole('button', { name: 'fake shot + done' }))
    await waitFor(() => expect(readyRows()).toHaveLength(1))
    expect(rows()[0]).toHaveTextContent('camera-1700000000000.jpg')
    expect(mockQuality).toHaveBeenCalledOnce()
    expect(mockCompress).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'fake shot + done' })).not.toBeInTheDocument()
  })
})

// Saved DO toast + an open detection session (8c leftovers).
function SessionProbe() {
  const s = useDetectionSession()
  useEffect(() => {
    session = s
  })
  return null
}
function renderWithSession() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/processing']}>
      <AuthProvider>
        <DetectionSessionProvider>
          <SessionProbe />
          <Routes>
            <Route path="/processing" element={<Processing />} />
            <Route path="/result" element={<ResultProbe />} />
          </Routes>
        </DetectionSessionProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return user
}
const kept = (id: string): SessionPhoto => ({
  id,
  original: photo(`${id}.jpg`),
  upload: photo(`${id}-small.jpg`, 1000),
  originalBytes: 3 * MB,
  uploadBytes: 1000,
  width: 800,
  height: 600,
  quality: OK,
  result: { imageId: 'img_1', filename: `${id}.jpg`, count: 2, cropBox: null, pipes: [], brightness: 'ok', originalBytes: 1, error: null },
})

describe('Processing: saved toast + open session (8c)', () => {
  it('toast lives in an always-mounted status region; ✕ closes it', async () => {
    const user = renderWithSession()
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    act(() => session.setLastSavedDo('DX9'))
    expect(region).toHaveTextContent('บันทึก DO DX9 แล้วSaved DO DX9')
    await user.click(within(region).getByRole('button', { name: /Close/ }))
    expect(region).toBeEmptyDOMElement()
    expect(session.lastSavedDo).toBeNull()
  })

  it('with an unsent review, shows Back to review (link to /result) and keeps the session', async () => {
    const user = renderWithSession()
    expect(screen.queryByTestId('session-banner')).not.toBeInTheDocument()
    act(() => session.start('b1', [kept('a')]))
    act(() => session.setEdits('a', { removed: [0], added: [], history: [{ type: 'toggle', index: 0 }] }))
    const back = within(screen.getByTestId('session-banner')).getByRole('link', { name: /Back to review/ })
    expect(back).toHaveAttribute('href', '/result')
    await user.click(back)
    expect(screen.getByTestId('result-page')).toHaveTextContent('b1')
    expect(session.edits.a.removed).toEqual([0])
  })

  it('Detect with an unsent review asks first: No keeps the review, Yes starts the new detection', async () => {
    mockUpload.mockResolvedValue({ batch_id: 'b9', images: [img(1, 44)] } as CountsResponse)
    const user = renderWithSession()
    act(() => session.start('b1', [kept('a')]))
    act(() => session.setEdits('a', { removed: [0], added: [], history: [{ type: 'toggle', index: 0 }] }))
    await addReady(user, photos(1))
    await user.click(cta())
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(/Start a new detection\?/)
    expect(mockUpload).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await user.click(cta())
    await user.click(screen.getByRole('button', { name: /No, keep it/ }))
    expect(mockUpload).not.toHaveBeenCalled()
    expect(session.batchId).toBe('b1')
    expect(session.edits.a.removed).toEqual([0])

    await user.click(cta())
    fakeClock()
    await user.click(screen.getByRole('button', { name: /Yes, detect/ }))
    expect(mockUpload).toHaveBeenCalledTimes(1)
    await screen.findByTestId('done-banner')
    await skipReviewDelay()
    expect(screen.getByTestId('result-page')).toHaveTextContent('b9')
    expect(session.edits).toEqual({})
  })

  it('Detect without a session does not ask', async () => {
    mockUpload.mockResolvedValue({ batch_id: 'b9', images: [img(1, 44)] } as CountsResponse)
    const user = renderWithSession()
    await addReady(user, photos(1))
    await user.click(cta())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })
})

describe('Processing: toast auto-hide (8c)', () => {
  it('hides itself after TOAST_MS and clears lastSavedDo', () => {
    vi.useFakeTimers()
    try {
      renderWithSession()
      act(() => session.setLastSavedDo('DX7'))
      expect(screen.getByTestId('saved-toast')).toHaveTextContent('Saved DO DX7')
      act(() => vi.advanceTimersByTime(TOAST_MS - 100))
      expect(screen.getByTestId('saved-toast')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(200))
      expect(screen.queryByTestId('saved-toast')).not.toBeInTheDocument()
      expect(session.lastSavedDo).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
