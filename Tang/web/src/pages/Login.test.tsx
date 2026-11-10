import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHealth } from '@/lib/api'
import { AuthProvider } from '@/lib/auth'
import Login from './Login'

vi.mock('@/lib/api', () => ({ getHealth: vi.fn() }))
const health = vi.mocked(getHealth)

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>
}
function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/processing" element={<p>processing page</p>} />
        </Routes>
        <Where />
      </AuthProvider>
    </MemoryRouter>,
  )
}
const idField = () => screen.getByLabelText(/รหัสพนักงาน/)
const pwField = () => screen.getByLabelText(/^รหัสผ่าน/)
const signInBtn = () => screen.getByRole('button', { name: /เข้าสู่ระบบ.*Sign in/ })
const eye = () => screen.getByRole('button', { name: /password/ })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  health.mockReset().mockResolvedValue(true)
})

describe('Login', () => {
  it('labels are Thai + English', async () => {
    renderLogin()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/เข้าสู่ระบบ.*Sign in/)
    expect(idField()).toBe(screen.getByLabelText(/Operator ID/))
    expect(pwField()).toBe(screen.getByLabelText(/^รหัสผ่าน.*Password/))
    expect(screen.getByRole('checkbox', { name: /จดจำการเข้าสู่ระบบ.*Keep me signed in/ })).toBeChecked()
    expect(screen.getByText(/Demo login only/)).toBeInTheDocument()
    expect(screen.getByText('นับท่อเหล็กจากรูปถ่าย')).toBeInTheDocument()
    // Forgot is disabled with a visible "contact admin" hint
    const forgot = screen.getByRole('button', { name: /ลืมรหัสผ่าน\? Forgot\?/ })
    expect(forgot).toBeDisabled()
    expect(forgot).toHaveAccessibleDescription(/ติดต่อผู้ดูแลระบบ · Contact admin/)
    expect(await screen.findByRole('status', { name: /API online/ })).toBeInTheDocument()
  })

  it('empty submit shows the summary + 2 field errors, focuses Operator ID and does not navigate', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(signInBtn())
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter Operator ID and password/)
    expect(idField()).toHaveAttribute('aria-invalid', 'true')
    expect(pwField()).toHaveAttribute('aria-invalid', 'true')
    expect(idField()).toHaveAccessibleDescription(/Operator ID is required/)
    expect(pwField()).toHaveAccessibleDescription(/Password is required/)
    expect(idField()).toHaveFocus()
    expect(screen.getByTestId('path')).toHaveTextContent('/login')
    expect(localStorage.getItem('spds.operator')).toBeNull()
  })

  it('typing clears that field error only; focus goes to the first empty field', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(signInBtn())
    await user.type(idField(), 'OP-7')
    expect(idField()).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText(/Operator ID is required/)).not.toBeInTheDocument()
    expect(pwField()).toHaveAttribute('aria-invalid', 'true')
    await user.click(signInBtn())
    expect(pwField()).toHaveFocus()
    await user.type(pwField(), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('valid login lands on /processing (keep me signed in = localStorage)', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(idField(), 'OP-7')
    await user.type(pwField(), 'x')
    await user.click(signInBtn())
    expect(screen.getByTestId('path')).toHaveTextContent('/processing')
    expect(localStorage.getItem('spds.operator')).toBe('OP-7')
  })

  it('keep me signed in off uses sessionStorage', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('checkbox'))
    await user.type(idField(), 'OP-7')
    await user.type(pwField(), 'x')
    await user.click(signInBtn())
    expect(screen.getByTestId('path')).toHaveTextContent('/processing')
    expect(sessionStorage.getItem('spds.operator')).toBe('OP-7')
    expect(localStorage.getItem('spds.operator')).toBeNull()
  })

  it('eye button toggles the input type, aria-pressed and its label', async () => {
    const user = userEvent.setup()
    renderLogin()
    expect(pwField()).toHaveAttribute('type', 'password')
    expect(eye()).toHaveAttribute('aria-pressed', 'false')
    expect(eye()).toHaveAccessibleName(/Show password/)
    await user.click(eye())
    expect(pwField()).toHaveAttribute('type', 'text')
    expect(eye()).toHaveAttribute('aria-pressed', 'true')
    expect(eye()).toHaveAccessibleName(/Hide password/)
    await user.click(eye())
    expect(pwField()).toHaveAttribute('type', 'password')
  })

  it('API offline: warning shows, sign in still works', async () => {
    health.mockResolvedValue(false)
    const user = userEvent.setup()
    renderLogin()
    expect(await screen.findByRole('alert')).toHaveTextContent(/Can't reach the API/)
    expect(screen.getByRole('status', { name: /API offline/ })).toBeInTheDocument()
    expect(signInBtn()).toBeEnabled()
    await user.type(idField(), 'OP-7')
    await user.type(pwField(), 'x')
    await user.click(signInBtn())
    expect(screen.getByTestId('path')).toHaveTextContent('/processing')
  })

  it('Check again re-checks /health: chip shows checking, then the new result', async () => {
    health.mockResolvedValue(false)
    const user = userEvent.setup()
    renderLogin()
    const again = await screen.findByRole('button', { name: /ตรวจสอบอีกครั้ง.*Check again/ })
    expect(health).toHaveBeenCalledTimes(1)

    let resolve!: (ok: boolean) => void
    health.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    await user.click(again)
    expect(health).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('api-status')).toHaveAttribute('data-api', 'checking')
    // warning (and its button) stay while checking
    expect(again).toBeInTheDocument()

    resolve(true)
    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveAttribute('data-api', 'online'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('touch targets are at least 44 px', async () => {
    health.mockResolvedValue(false)
    renderLogin()
    const again = await screen.findByRole('button', { name: /Check again/ })
    expect(again).toHaveClass('min-h-11') // 44 px
    expect(eye()).toHaveClass('size-11')
    expect(signInBtn()).toHaveClass('min-h-13') // 52 px
    expect(screen.getByRole('button', { name: /Forgot/ })).toHaveClass('min-h-11')
    expect(screen.getByRole('checkbox').closest('label')).toHaveClass('min-h-11')
    expect(idField()).toHaveClass('min-h-12') // 48 px input
  })
})
