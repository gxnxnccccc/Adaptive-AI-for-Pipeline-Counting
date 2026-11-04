import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { bi, t } from '@/lib/i18n'

const input = 'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base'

export default function Login() {
  const { operator, login } = useAuth()
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [keep, setKeep] = useState(true)
  const [error, setError] = useState(false)

  if (operator) return <Navigate to="/new" replace />

  function submit(e: FormEvent) {
    e.preventDefault()
    if (login(id, pw, keep)) navigate('/new', { replace: true })
    else setError(true)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-md">
        <h1 className="flex flex-col text-xl font-bold text-blue-700">
          {t.appTitle.th}
          <span className="text-sm font-normal text-gray-600">{t.appTitle.en}</span>
        </h1>
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{bi(t.demoLogin)}</p>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {bi(t.operatorId)}
          <input className={input} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {bi(t.password)}
          <span className="flex gap-2">
            <input
              className={input}
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={bi(show ? t.hidePw : t.showPw)}
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </span>
        </label>

        <div className="flex items-center justify-between gap-2 text-sm text-gray-700">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            {bi(t.keepSignedIn)}
          </label>
          <button type="button" disabled title={bi(t.forgotHint)} className="min-h-11 text-gray-500">
            {bi(t.forgot)}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {bi(t.loginRequired)}
          </p>
        )}
        <Button type="submit" size="lg" className="bg-blue-600 text-white hover:bg-blue-700">
          {bi(t.login)}
        </Button>
      </form>
    </div>
  )
}
