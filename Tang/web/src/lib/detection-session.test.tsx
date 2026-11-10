import { useEffect, type ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/auth'
import { NO_EDITS, toggleRemoved } from '@/lib/corrections'
import { DetectionSessionProvider, useDetectionSession, type SessionPhoto } from '@/lib/detection-session'
import Processing from '@/pages/Processing'

vi.mock('@/lib/api', () => ({ uploadImages: vi.fn(), getHealth: vi.fn(() => Promise.resolve(true)) }))

// Exposes session + auth actions to the test.
let api: { session: ReturnType<typeof useDetectionSession>; auth: ReturnType<typeof useAuth> }
function Probe() {
  const session = useDetectionSession()
  const auth = useAuth()
  useEffect(() => {
    api = { session, auth }
  })
  return <output data-testid="batch">{session.batchId ?? 'none'}</output>
}

function renderSession(children: ReactNode = null) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DetectionSessionProvider>
          <Probe />
          {children}
        </DetectionSessionProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('spds.operator', 'OP-1')
})
afterEach(() => vi.useRealTimers())

const photo = (id: string): SessionPhoto => ({
  id,
  original: new File(['x'], `${id}.png`, { type: 'image/png' }),
  upload: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }),
  originalBytes: 1,
  uploadBytes: 1,
  width: 100,
  height: 100,
  quality: null,
  result: { imageId: `img_${id}`, filename: `${id}.png`, count: 1, cropBox: null, pipes: [], brightness: 'ok', originalBytes: 1, error: null },
})

describe('detection session', () => {
  it('clears on logout', () => {
    renderSession()
    act(() => api.session.start('b1', []))
    expect(screen.getByTestId('batch')).toHaveTextContent('b1')
    act(() => api.auth.logout())
    expect(screen.getByTestId('batch')).toHaveTextContent('none')
  })

  it('clears when a different operator logs in', () => {
    renderSession()
    act(() => api.session.start('b1', []))
    act(() => {
      api.auth.login('OP-2', 'x')
    })
    expect(screen.getByTestId('batch')).toHaveTextContent('none')
  })

  it('start() sets the batch and photos', () => {
    renderSession()
    act(() => api.session.start('b1', [photo('a'), photo('b')]))
    expect(api.session.batchId).toBe('b1')
    expect(api.session.photos.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('removePhoto() drops only that photo and keeps the batch', () => {
    renderSession()
    act(() => api.session.start('b1', [photo('a'), photo('b'), photo('c')]))
    act(() => api.session.removePhoto('b'))
    expect(api.session.photos.map((p) => p.id)).toEqual(['a', 'c'])
    expect(api.session.batchId).toBe('b1')
  })

  it('clear() drops the detection but keeps lastSavedDo', () => {
    renderSession()
    act(() => {
      api.session.start('b1', [photo('a')])
      api.session.setLastSavedDo('DX9')
      api.session.clear()
    })
    expect(api.session.batchId).toBeNull()
    expect(api.session.photos).toEqual([])
    expect(api.session.lastSavedDo).toBe('DX9')
  })
})

describe('detection session edits', () => {
  const edited = toggleRemoved(NO_EDITS, 0)

  it('setEdits() stores edits per photo and keeps them across re-renders', () => {
    const { rerender } = renderSession()
    act(() => api.session.start('b1', [photo('a'), photo('b')]))
    act(() => api.session.setEdits('a', edited))
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <DetectionSessionProvider>
            <Probe />
          </DetectionSessionProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(api.session.edits).toEqual({ a: edited })
  })

  it("removePhoto() drops that photo's edits only", () => {
    renderSession()
    act(() => api.session.start('b1', [photo('a'), photo('b')]))
    act(() => {
      api.session.setEdits('a', edited)
      api.session.setEdits('b', edited)
    })
    act(() => api.session.removePhoto('a'))
    expect(api.session.edits).toEqual({ b: edited })
  })

  it('start() and clear() reset the edits', () => {
    renderSession()
    act(() => api.session.start('b1', [photo('a')]))
    act(() => api.session.setEdits('a', edited))
    act(() => api.session.start('b2', [photo('a')]))
    expect(api.session.edits).toEqual({})
    act(() => api.session.setEdits('a', edited))
    act(() => api.session.clear())
    expect(api.session.edits).toEqual({})
  })
})

describe('Processing saved toast', () => {
  it('auto-closes after 5 s', () => {
    vi.useFakeTimers()
    renderSession(<Processing />)
    act(() => api.session.setLastSavedDo('DX1'))
    expect(screen.getByTestId('saved-toast')).toHaveTextContent('Saved DO DX1')
    act(() => vi.advanceTimersByTime(4_900))
    expect(screen.getByTestId('saved-toast')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByTestId('saved-toast')).not.toBeInTheDocument()
  })
})
