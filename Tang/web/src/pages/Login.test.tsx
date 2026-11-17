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
// A correct login first plays the crew's jump (WELCOME_MS), then opens /processing.
const landsOnProcessing = () => waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/processing'), { timeout: 3000 })
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
    expect(screen.getByText(/Demo login, not real security/)).toBeInTheDocument()
    expect(screen.getByText('spds')).toBeInTheDocument() // demo password shown on the card
    expect(screen.getByText('นับท่อเหล็กจากรูปถ่าย')).toBeInTheDocument()
    // "Forgot" is plain help text now, not a struck-through disabled button
    expect(screen.queryByRole('button', { name: /Forgot/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Ask your admin/)).toBeInTheDocument()
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
    await user.type(pwField(), 'spds')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('valid login lands on /processing (keep me signed in = localStorage)', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(idField(), 'OP-7')
    await user.type(pwField(), 'spds')
    await user.click(signInBtn())
    await landsOnProcessing()
    expect(localStorage.getItem('spds.operator')).toBe('OP-7')
  })

  it('correct password: the crew jumps and the button says Welcome, then it signs in and opens /processing', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(idField(), 'OP-7')
    await user.type(pwField(), 'spds')
    await user.click(signInBtn())
    // Not signed in yet: login() remounts the app (session keyed by operator), which would cut the jump short.
    expect(localStorage.getItem('spds.operator')).toBeNull()
    expect(screen.getByTestId('crew')).toHaveAttribute('data-mood', 'happy')
    expect(screen.getByRole('button', { name: /ยินดีต้อนรับ.*Welcome/ })).toBeInTheDocument()
    expect(screen.getByTestId('welcome-status')).toHaveTextContent('Welcome')
    expect(screen.getByTestId('path')).toHaveTextContent('/login')
    await landsOnProcessing()
    expect(localStorage.getItem('spds.operator')).toBe('OP-7')
  })

  it('reduced motion: no jump, straight to /processing', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    const user = userEvent.setup()
    renderLogin()
    await user.type(idField(), 'OP-7')
    await user.type(pwField(), 'spds')
    await user.click(signInBtn())
    expect(screen.getByTestId('path')).toHaveTextContent('/processing')
    vi.unstubAllGlobals()
  })

  it('keep me signed in off uses sessionStorage', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('checkbox'))
    await user.type(idField(), 'OP-7')
    await user.type(pwField(), 'spds')
    await user.click(signInBtn())
    await landsOnProcessing()
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
    await user.type(pwField(), 'spds')
    await user.click(signInBtn())
    await landsOnProcessing()
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
    expect(screen.getByRole('checkbox').closest('label')).toHaveClass('min-h-11')
    expect(idField()).toHaveClass('min-h-12') // 48 px input
  })

  it('wrong password: field error with the demo password, crew recoils, no navigation', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(idField(), 'OP-07')
    await user.type(pwField(), 'nope')
    await user.click(signInBtn())
    expect(screen.getByRole('alert')).toHaveTextContent(/Wrong password\. The demo password is spds/)
    expect(pwField()).toHaveAttribute('aria-invalid', 'true')
    expect(pwField()).toHaveFocus()
    expect(screen.getByTestId('crew')).toHaveAttribute('data-mood', 'wrong')
    expect(screen.queryByText('PROCESSING')).not.toBeInTheDocument()
    await user.type(pwField(), 'x') // editing clears the error
    expect(pwField()).not.toHaveAttribute('aria-invalid')
  })

  it('crew: idle, leans in while a field has focus, turns away while the password is shown', async () => {
    const user = userEvent.setup()
    renderLogin()
    const crew = screen.getByTestId('crew')
    expect(crew).toHaveAttribute('data-mood', 'idle')
    await user.click(idField())
    expect(crew).toHaveAttribute('data-mood', 'watch')
    await user.click(eye())
    expect(crew).toHaveAttribute('data-mood', 'away')
    await user.click(eye())
    expect(crew).not.toHaveAttribute('data-mood', 'away')
  })

  it('Caps Lock on while typing the password: warning tied to the field; gone on blur', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(pwField())
    await user.keyboard('{CapsLock}a')
    expect(screen.getByTestId('caps-lock')).toHaveTextContent(/Caps Lock เปิดอยู่.*Caps Lock is on/)
    expect(pwField()).toHaveAttribute('aria-describedby', 'login-pw-caps')
    await user.keyboard('{CapsLock}b')
    expect(screen.queryByTestId('caps-lock')).not.toBeInTheDocument()
    await user.keyboard('{CapsLock}c')
    expect(screen.getByTestId('caps-lock')).toBeInTheDocument()
    await user.click(idField())
    expect(screen.queryByTestId('caps-lock')).not.toBeInTheDocument()
  })
})
