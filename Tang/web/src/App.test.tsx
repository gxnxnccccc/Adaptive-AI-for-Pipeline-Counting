import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHealth } from '@/lib/api'
import App from './App'

vi.mock('@/lib/api', () => ({
  uploadImages: vi.fn(),
  getHealth: vi.fn(),
  getStats: vi.fn(() => new Promise(() => {})),
  listRecords: vi.fn(() => new Promise(() => {})),
  getDailyStats: vi.fn(() => new Promise(() => {})),
}))
const health = vi.mocked(getHealth)

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>
}
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  )
}
const path = () => screen.getByTestId('path')
const idField = () => screen.getByLabelText(/Operator ID/)
const pwField = () => screen.getByLabelText(/^รหัสผ่าน/)
const signedIn = () => localStorage.setItem('spds.operator', 'OP-07')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  health.mockReset().mockResolvedValue(true)
})

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(idField(), 'OP-7')
  await user.type(pwField(), 'x')
  await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
}

describe('routes + auth', () => {
  it('protected route redirects to login when logged out', () => {
    renderAt('/dashboard')
    expect(path()).toHaveTextContent('/login')
    expect(idField()).toBeInTheDocument()
  })

  it('/ goes to login, then to /processing after login', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await signIn(user)
    expect(await screen.findByRole('heading', { name: /ถ่าย \/ อัปโหลดรูป/ })).toBeInTheDocument()
    expect(path()).toHaveTextContent('/processing')
    expect(localStorage.getItem('spds.operator')).toBe('OP-7')
  })

  it.each(['/nope', '/new', '/records'])('%s goes to /processing when signed in', (p) => {
    signedIn()
    renderAt(p)
    expect(path()).toHaveTextContent('/processing')
  })

  it('/result without a detection session goes to /processing', () => {
    signedIn()
    renderAt('/result')
    expect(path()).toHaveTextContent('/processing')
  })

  it('/login when already signed in goes to /processing', () => {
    signedIn()
    renderAt('/login')
    expect(path()).toHaveTextContent('/processing')
  })

  it('empty form is blocked', async () => {
    const user = userEvent.setup()
    renderAt('/login')
    await user.type(idField(), 'OP-7') // password still empty
    await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(localStorage.getItem('spds.operator')).toBeNull()
  })

  it('shows the demo-login note', () => {
    renderAt('/login')
    expect(screen.getByText(/Demo login only/)).toBeInTheDocument()
  })

  it('logout returns to /login', async () => {
    const user = userEvent.setup()
    renderAt('/login')
    await signIn(user)
    // Sidebar (desktop) and top bar (phone) both have a logout button; CSS hides one.
    await user.click((await screen.findAllByRole('button', { name: /ออกจากระบบ/ }))[0])
    expect(path()).toHaveTextContent('/login')
    expect(idField()).toBeInTheDocument()
    expect(localStorage.getItem('spds.operator')).toBeNull()
  })
})

describe('AppShell', () => {
  it('shows the operator, page title and 2 nav items with no Records link', () => {
    signedIn()
    renderAt('/dashboard')
    expect(screen.getAllByText('OP-07').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1, name: /แดชบอร์ด/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /แดชบอร์ด/ })[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link', { name: /ตรวจนับใหม่/ })[0]).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('link', { name: /Records/ })).not.toBeInTheDocument()
  })

  it('2-step flow: step 1 is current on /processing, no flow on /dashboard', () => {
    signedIn()
    const { unmount } = renderAt('/processing')
    const current = screen.getByTestId('flow').querySelectorAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent(/1.*Capture/)
    unmount()
    renderAt('/dashboard')
    expect(screen.queryByTestId('flow')).not.toBeInTheDocument()
  })

  it('API chip: checking while /health is pending', () => {
    health.mockReturnValue(new Promise(() => {}))
    signedIn()
    renderAt('/processing')
    expect(screen.getByTestId('api-status')).toHaveAttribute('data-api', 'checking')
    expect(screen.getByTestId('api-status')).toHaveAccessibleName(/Checking API/)
  })

  it('API chip: online', async () => {
    signedIn()
    renderAt('/processing')
    expect(await screen.findByRole('status', { name: /API online/ })).toHaveAttribute('data-api', 'online')
  })

  it('API chip: offline', async () => {
    health.mockResolvedValue(false)
    signedIn()
    renderAt('/processing')
    expect(await screen.findByRole('status', { name: /API offline/ })).toHaveAttribute('data-api', 'offline')
  })
})
