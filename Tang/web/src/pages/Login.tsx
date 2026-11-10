import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, RefreshCw, TriangleAlert, User } from 'lucide-react'
import ApiChip, { useApiStatus, type ApiStatus } from '@/components/ApiChip'
import BrandMark from '@/components/BrandMark'
import PipeArt from '@/components/PipeArt'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Layout + states from docs/design/preview/login.html (default, empty fields, checking, API offline).
// Login is the MOCK from lib/auth.tsx (any non-empty ID + password); the card says so.

const En = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('text-[12.5px] font-normal tracking-[.01em] text-tx-3', className)}>{children}</span>
)
const Bi = ({ p, className }: { p: Pair; className?: string }) => (
  <span className={cn('inline-flex flex-col leading-tight', className)}>
    <span>{p.th}</span> <En>{p.en}</En>
  </span>
)

const input =
  'min-h-12 w-full rounded-control border border-line-2 bg-bg py-2.5 pr-3.5 pl-11 text-base text-tx transition-[border-color,box-shadow] hover:border-tx-3/60 focus:border-accent focus:ring-3 focus:ring-accent/25 focus:outline-none aria-invalid:border-err aria-invalid:ring-3 aria-invalid:ring-err/20'
const fieldIcon = 'pointer-events-none absolute top-3.5 left-3.5 size-5 text-tx-3'
const label = 'flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold'

function FieldError({ id, p }: { id: string; p: Pair }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-err">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span>{p.th}</span> <span className="text-[12.5px] text-err/85">{p.en}</span>
      </span>
    </p>
  )
}

function Brand() {
  return (
    <div className="flex min-h-11 items-center gap-2.5">
      <BrandMark />
    </div>
  )
}

export default function Login() {
  const { operator, login } = useAuth()
  const navigate = useNavigate()
  const { status, recheck } = useApiStatus()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [keep, setKeep] = useState(true)
  const [errors, setErrors] = useState({ id: false, pw: false })
  const idRef = useRef<HTMLInputElement>(null)
  const pwRef = useRef<HTMLInputElement>(null)

  // Keep the offline warning up while "Check again" runs, so its button (and focus) doesn't vanish.
  const [known, setKnown] = useState<ApiStatus>(status)
  if (status !== 'checking' && status !== known) setKnown(status)
  const offline = known === 'offline'

  // "Check again" worked: the warning (and the button that had focus) disappears, so focus goes to the first field.
  const refocus = useRef(false)
  useEffect(() => {
    if (status === 'offline') refocus.current = false // still down: nothing to hand focus to yet
    else if (!offline && refocus.current) {
      refocus.current = false
      idRef.current?.focus()
    }
  }, [status, offline])

  if (operator) return <Navigate to="/processing" replace />

  function submit(e: FormEvent) {
    e.preventDefault()
    const next = { id: !id.trim(), pw: !pw.trim() } // same rule as auth.login
    if (next.id || next.pw) {
      setErrors(next)
      ;(next.id ? idRef : pwRef).current?.focus()
      return
    }
    // Sign-in is allowed while the API is offline (Tang 2026-11-09); the warning above says detection won't work.
    if (login(id, pw, keep)) navigate('/processing', { replace: true })
  }

  return (
    <div className="relative flex min-h-dvh flex-col min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(460px,.85fr)]">
      <div className="absolute top-3.5 left-4 z-[3] min-[900px]:top-6 min-[900px]:left-7">
        <Brand />
      </div>

      <section
        aria-label={bi(t.illustrationLabel)}
        className="relative h-[210px] overflow-hidden border-b border-line bg-photo-bg min-[900px]:h-auto min-[900px]:border-r min-[900px]:border-b-0"
      >
        <PipeArt />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgb(2_6_23/.75)_0%,rgb(2_6_23/.1)_35%,rgb(2_6_23/.35)_70%,rgb(2_6_23/.95)_100%)] min-[900px]:bg-[linear-gradient(180deg,rgb(2_6_23/.8)_0%,rgb(2_6_23/.05)_30%,rgb(2_6_23/.25)_60%,rgb(2_6_23/.97)_100%)]"
        />
        <span className="absolute top-7 right-7 z-[2] hidden min-h-[30px] items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap min-[900px]:inline-flex">
          <span>{t.illustration.th}</span> <En className="text-xs">{t.illustration.en}</En>
        </span>
        <div className="absolute inset-x-4 bottom-3.5 z-[2] flex flex-col gap-2.5 min-[900px]:inset-x-8 min-[900px]:bottom-8 min-[900px]:gap-4">
          <p className="flex flex-col text-xl leading-tight font-bold min-[900px]:text-[34px]">
            <span>{t.tagline.th}</span>{' '}
            <span className="text-[13px] font-normal text-tx-2 min-[900px]:text-base min-[900px]:font-medium">{t.tagline.en}</span>
          </p>
          <ol className="m-0 hidden list-none flex-wrap gap-2 p-0 min-[900px]:flex">
            {t.loginSteps.map((s, i) => (
              <li
                key={s.en}
                className="flex items-center gap-2 rounded-full border border-line bg-surface/85 py-1.5 pr-3 pl-1.5 text-sm font-semibold"
              >
                <span className="grid size-[26px] place-items-center rounded-full border border-accent/40 bg-accent/12 font-mono text-[13px] text-accent">
                  {i + 1}
                </span>
                <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                  <span>{s.th}</span> <En>{s.en}</En>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <main className="flex flex-1 flex-col items-center justify-center gap-3.5 px-4 pt-5 pb-7">
        <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-[0_20px_50px_rgb(0_0_0/.45)] min-[900px]:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="flex flex-col text-2xl leading-tight font-bold">
              <span>{t.login.th}</span> <span className="text-sm font-medium text-tx-3">{t.login.en}</span>
            </h1>
            <ApiChip status={status} />
          </div>

          <div className="flex items-start gap-3 rounded-control border border-line bg-raised px-3.5 py-3 text-[15px]">
            <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
            <Bi p={t.demoLogin} />
          </div>

          {offline && (
            <div
              role="alert"
              className="flex flex-wrap items-start gap-3 rounded-control border border-warn/50 bg-warn/12 px-3.5 py-3 text-[15px]"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warn" />
              <p className="flex min-w-[200px] flex-1 flex-col leading-tight">
                <b>{t.apiDownTitle.th}</b> <En>{t.apiDownTitle.en}</En>
                <span className="mt-1">{t.apiDownLogin.th}</span> <En>{t.apiDownLogin.en}</En>
              </p>
              <Button variant="secondary" className="ml-auto" onClick={() => {
                  refocus.current = true
                  recheck()
                }}
                aria-busy={status === 'checking'}>
                <RefreshCw aria-hidden="true" className={cn('size-5', status === 'checking' && 'animate-spin')} />
                <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                  <span>{t.checkAgain.th}</span> <En>{t.checkAgain.en}</En>
                </span>
              </Button>
            </div>
          )}

          {(errors.id || errors.pw) && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-control border border-err/50 bg-err/12 px-3.5 py-3 text-[15px]"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-err" />
              <p className="flex flex-col leading-tight">
                <b>{t.loginRequired.th}</b> <En>{t.loginRequired.en}</En>
              </p>
            </div>
          )}

          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-op" className={label}>
                <span>{t.operatorId.th}</span> <En>{t.operatorId.en}</En>
              </label>
              <div className="relative">
                <User aria-hidden="true" className={fieldIcon} />
                <input
                  ref={idRef}
                  id="login-op"
                  name="username"
                  className={cn(input, 'font-mono tabular-nums')}
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value)
                    setErrors((er) => ({ ...er, id: false }))
                  }}
                  autoComplete="username"
                  placeholder={t.opPlaceholder}
                  spellCheck={false}
                  aria-invalid={errors.id || undefined}
                  aria-describedby={errors.id ? 'login-op-err' : undefined}
                />
              </div>
              {errors.id && <FieldError id="login-op-err" p={t.opRequired} />}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-pw" className={label}>
                <span>{t.password.th}</span> <En>{t.password.en}</En>
              </label>
              <div className="relative">
                <Lock aria-hidden="true" className={fieldIcon} />
                <input
                  ref={pwRef}
                  id="login-pw"
                  name="password"
                  className={cn(input, 'pr-13')}
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value)
                    setErrors((er) => ({ ...er, pw: false }))
                  }}
                  autoComplete="current-password"
                  aria-invalid={errors.pw || undefined}
                  aria-describedby={errors.pw ? 'login-pw-err' : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0.5 right-0.5"
                  aria-pressed={show}
                  aria-label={bi(show ? t.hidePw : t.showPw)}
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
                </Button>
              </div>
              {errors.pw && <FieldError id="login-pw-err" p={t.pwRequired} />}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-medium">
                <input
                  type="checkbox"
                  checked={keep}
                  onChange={(e) => setKeep(e.target.checked)}
                  className="grid size-[22px] shrink-0 cursor-pointer appearance-none place-items-center rounded-chip border-[1.5px] border-line-2 bg-bg checked:border-accent checked:bg-accent checked:after:block after:hidden after:h-[11px] after:w-1.5 after:-translate-y-px after:rotate-45 after:border-r-[2.5px] after:border-b-[2.5px] after:border-accent-ink"
                />
                <Bi p={t.keepSignedIn} />
              </label>
              <div className="flex flex-col items-end text-right">
                <button
                  type="button"
                  disabled
                  aria-describedby="login-forgot-hint"
                  className="min-h-11 cursor-not-allowed px-1 text-[15px] font-semibold text-tx-3 line-through decoration-tx-3/50"
                >
                  {t.forgot.th} <span className="text-[12.5px] font-normal">{t.forgot.en}</span>
                </button>
                <span id="login-forgot-hint" className="-mt-2 text-[13px] text-tx-3">
                  {bi(t.forgotHint)}
                </span>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full">
              <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                <span>{t.login.th}</span> <span className="text-[12.5px] font-medium text-accent-ink/75">{t.login.en}</span>
              </span>
              <ArrowRight aria-hidden="true" className="size-5" />
            </Button>
          </form>
        </div>
        <En>{bi(t.loginFoot)}</En>
      </main>
    </div>
  )
}
