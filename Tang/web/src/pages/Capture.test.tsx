import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CountsResponse } from '@/lib/detection'
import { uploadImages } from '@/lib/api'
import Capture from './Capture'

vi.mock('@/lib/api', () => ({ uploadImages: vi.fn() }))
const mockUpload = vi.mocked(uploadImages)

function png(name: string) {
  return new File(['x'], name, { type: 'image/png' })
}
function pngs(n: number) {
  return Array.from({ length: n }, (_, i) => png(`p${i + 1}.png`))
}

function ok(filename: string, n: number, count: number, brightness = 'ok') {
  return {
    image_id: `img_${n}`,
    filename,
    count,
    crop_box: [0, 0, 10, 10],
    pipes: [],
    quality: { brightness },
    original_bytes: 1,
    error: null,
  }
}
function failed(filename: string, n: number, error: string) {
  return { image_id: `img_${n}`, filename, count: null, crop_box: null, pipes: [], quality: null, original_bytes: 1, error }
}

const rows = () => screen.queryAllByRole('listitem')
const pickInput = () => screen.getByLabelText(/เลือกรูป/)

beforeEach(() => {
  // jsdom has no object URLs; real ones are unique, so make these unique too
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:fake-${n++}`)
  URL.revokeObjectURL = vi.fn()
  mockUpload.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('Capture screen', () => {
  it('dropping 5 files shows 5 queued rows', () => {
    render(<Capture />)
    const zone = screen.getByTestId('dropzone')
    fireEvent.drop(zone, { dataTransfer: { files: pngs(5) } })
    expect(rows()).toHaveLength(5)
    expect(screen.getAllByText(/รอส่ง/)).toHaveLength(5)
  })

  it('selecting 5 files with the picker shows 5 rows, add-more appends', async () => {
    const user = userEvent.setup()
    render(<Capture />)
    await user.upload(pickInput(), pngs(5))
    expect(rows()).toHaveLength(5)
    await user.upload(pickInput(), [png('extra.png')])
    expect(rows()).toHaveLength(6)
  })

  it('shows done rows with counts and one failed row with its error', async () => {
    const user = userEvent.setup()
    const resp: CountsResponse = {
      batch_id: 'b_1',
      images: [ok('p1.png', 1, 42), failed('p2.png', 2, 'cannot decode image'), ok('p3.png', 3, 17)],
    }
    mockUpload.mockResolvedValue(resp)
    render(<Capture />)
    await user.upload(pickInput(), pngs(3))
    await user.click(screen.getByRole('button', { name: /อัปโหลด/ }))

    await waitFor(() => expect(screen.getByText(/42/)).toBeInTheDocument())
    const [r1, r2, r3] = rows()
    expect(within(r1).getByText(/42/)).toBeInTheDocument()
    expect(within(r2).getByText(/cannot decode image/)).toBeInTheDocument()
    expect(within(r2).getByText(/ไม่สำเร็จ/)).toBeInTheDocument()
    expect(within(r3).getByText(/17/)).toBeInTheDocument()
    expect(mockUpload.mock.calls[0][0]).toHaveLength(3)
  })

  it('a whole-request failure marks the uploading rows failed with the message', async () => {
    const user = userEvent.setup()
    mockUpload.mockRejectedValue(new Error('Upload failed: 413 Payload Too Large'))
    render(<Capture />)
    await user.upload(pickInput(), pngs(2))
    await user.click(screen.getByRole('button', { name: /อัปโหลด/ }))
    await waitFor(() => expect(screen.getAllByText(/413/)).toHaveLength(2))
  })

  it('removing one row leaves 4 and revokes its thumbnail URL', async () => {
    const user = userEvent.setup()
    render(<Capture />)
    await user.upload(pickInput(), pngs(5))
    await user.click(screen.getByRole('button', { name: /p3\.png/ }))
    expect(rows()).toHaveLength(4)
    expect(screen.queryByText('p3.png')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('selecting 11 files shows the limit message and keeps 10', async () => {
    const user = userEvent.setup()
    render(<Capture />)
    await user.upload(pickInput(), pngs(11))
    expect(rows()).toHaveLength(10)
    expect(screen.getByRole('alert')).toHaveTextContent(/10/)
  })

  it('rejects a file over 15 MB with a message', async () => {
    const user = userEvent.setup()
    render(<Capture />)
    const big = png('big.png')
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })
    await user.upload(pickInput(), [big, png('small.png')])
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent(/big\.png/)
  })

  it('shows a dark-photo warning when brightness is dark', async () => {
    const user = userEvent.setup()
    mockUpload.mockResolvedValue({ batch_id: 'b', images: [ok('p1.png', 1, 30, 'dark')] })
    render(<Capture />)
    await user.upload(pickInput(), pngs(1))
    await user.click(screen.getByRole('button', { name: /อัปโหลด/ }))
    expect(await screen.findByText(/มืดเกินไป/)).toBeInTheDocument()
    expect(screen.getByText(/too dark/i)).toBeInTheDocument()
  })

  it('revokes all thumbnail URLs on unmount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Capture />)
    await user.upload(pickInput(), pngs(3))
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
  })
})
