import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCountsTotal, getHealth } from '@/lib/api'
import App from './App'

vi.mock('@/lib/api', () => ({ uploadImages: vi.fn(), getHealth: vi.fn(), getCountsTotal: vi.fn() }))
const health = vi.mocked(getHealth)
const total = vi.mocked(getCountsTotal)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
const idField = () => screen.getByLabelText(/Operator ID/)
const pwField = () => screen.getByLabelText(/^รหัสผ่าน/)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  health.mockReset().mockResolvedValue(true)
  total.mockReset().mockResolvedValue(7)
})

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(idField(), 'OP-7')
  await user.type(pwField(), 'x')
  await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
}

describe('auth + shell', () => {
  it('protected route redirects to login when logged out', () => {
    renderAt('/records')
    expect(idField()).toBeInTheDocument()
  })

  it('/ goes to login, then to New Detection after login', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await signIn(user)
    expect(await screen.findByRole('heading', { name: /ถ่าย \/ อัปโหลดรูป/ })).toBeInTheDocument()
    expect(localStorage.getItem('spds.operator')).toBe('OP-7')
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

  it('logout returns to login', async () => {
    const user = userEvent.setup()
    renderAt('/login')
    await signIn(user)
    await user.click(await screen.findByRole('button', { name: /ออกจากระบบ/ }))
    expect(idField()).toBeInTheDocument()
    expect(localStorage.getItem('spds.operator')).toBeNull()
  })

  it('shows records badge and green API chip', async () => {
    const user = userEvent.setup()
    renderAt('/login')
    await signIn(user)
    expect(await screen.findByTestId('records-badge')).toHaveTextContent('7')
    expect(await screen.findByTestId('api-status')).toHaveTextContent(/^API$/)
  })

  it('red chip and no badge when the API is down', async () => {
    health.mockResolvedValue(false)
    total.mockRejectedValue(new Error('x'))
    const user = userEvent.setup()
    renderAt('/login')
    await signIn(user)
    expect(await screen.findByTestId('api-status')).toHaveTextContent(/offline/)
    await waitFor(() => expect(total).toHaveBeenCalled())
    expect(screen.queryByTestId('records-badge')).not.toBeInTheDocument()
  })
})
