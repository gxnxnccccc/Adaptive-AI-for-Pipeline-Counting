import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, RefreshCw, TriangleAlert, User } from 'lucide-react'
import ApiChip, { useApiStatus, type ApiStatus } from '@/components/ApiChip'
import BrandMark from '@/components/BrandMark'
import LoginCrew, { type CrewMood } from '@/components/LoginCrew'
import { Button } from '@/components/ui/button'
import { DEMO_PASSWORD, useAuth } from '@/lib/auth'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Left half: LoginCrew (docs/design/login-crew.md). Right half: the sign-in card
// (states: default, empty fields, wrong password, checking, API offline).
// Login is the MOCK from lib/auth.tsx (any non-empty ID + DEMO_PASSWORD); the card says so.

const En = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('text-[12.5px] font-normal tracking-[.01em] text-tx-3', className)}>{children}</span>
)
const Bi = ({ p, className }: { p: Pair; className?: string }) => (
  <span className={cn('inline-flex flex-col leading-tight', className)}>
    <span>{p.th}</span> <En>{p.en}</En>
  </span>
)

const input =
  'min-h-12 w-full rounded-control border border-line-2 bg-surface py-2.5 pr-3.5 pl-11 text-base text-tx transition-[border-color,box-shadow] hover:border-tx-3/60 focus:border-accent focus:ring-3 focus:ring-accent/25 focus:outline-none aria-invalid:border-err aria-invalid:ring-3 aria-invalid:ring-err/20'
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


export default function Login() {
  const { operator, login } = useAuth()
  const navigate = useNavigate()
  const { status, recheck } = useApiStatus()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [keep, setKeep] = useState(true)
  const [errors, setErrors] = useState({ id: false, pw: false })
  const [pwWrong, setPwWrong] = useState(false)
  // Crew: which field has focus, and a short "wrong" mood after each bad password.
  const [focus, setFocus] = useState<'id' | 'pw' | null>(null)
  const [wrongKey, setWrongKey] = useState(0)
  const [crewWrong, setCrewWrong] = useState(false)
  useEffect(() => {
    if (!wrongKey) return
    const timer = setTimeout(() => setCrewWrong(false), 1400)
    return () => clearTimeout(timer)
  }, [wrongKey])
  const mood: CrewMood = crewWrong ? 'wrong' : show ? 'away' : focus ? 'watch' : 'idle'
  const look = Math.min(1, (focus === 'pw' ? pw.length : id.length) / 16)
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
    if (login(id, pw, keep)) {
      navigate('/processing', { replace: true })
      return
    }
    setPwWrong(true)
    setCrewWrong(true)
    setWrongKey((k) => k + 1)
    pwRef.current?.select()
    pwRef.current?.focus()
  }

  return (
    <div className="relative flex min-h-dvh flex-col min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(460px,.9fr)]">
      <section
        aria-label={bi(t.crewLabel)}
        className="relative flex flex-col gap-3 overflow-hidden bg-accent px-4 pt-4 text-accent-ink min-[900px]:gap-6 min-[900px]:px-10 min-[900px]:pt-8"
      >
        <div className="flex min-h-11 items-center gap-2.5">
          <BrandMark onDark withSub={false} />
        </div>
        <p className="flex flex-col gap-1 font-display text-[22px] leading-tight font-medium min-[900px]:max-w-[16ch] min-[900px]:text-[44px]">
          <span>{t.tagline.th}</span>
          <span className="font-sans text-[13px] font-normal text-accent-ink/80 min-[900px]:text-base">{t.tagline.en}</span>
        </p>
        <div className="mx-auto mt-auto w-full max-w-[300px] min-[900px]:my-auto min-[900px]:max-w-[640px] min-[900px]:pb-6">
          <LoginCrew mood={mood} look={look} lookRow={focus === 'pw' ? 1 : 0} wrongKey={wrongKey} />
        </div>
      </section>

      <main className="flex flex-1 flex-col items-center justify-center gap-3.5 px-4 pt-5 pb-7">
        <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card min-[900px]:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="flex flex-col font-display text-[28px] leading-tight font-semibold text-accent">
              <span>{t.login.th}</span> <span className="text-sm font-medium text-tx-3">{t.login.en}</span>
            </h1>
            <ApiChip status={status} />
          </div>

          <div className="flex items-start gap-3 rounded-control bg-pink-soft px-3.5 py-3 text-[15px]">
            <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pink-ink" />
            <p className="flex flex-1 flex-col leading-tight">
              <span>{t.demoLogin.th}</span>
              <En className="mt-0.5">{t.demoLogin.en}</En>
            </p>
            <span className="flex shrink-0 flex-col items-end leading-tight">
              <code className="rounded-chip bg-surface px-2 py-0.5 font-mono text-base font-bold text-pink-ink">{DEMO_PASSWORD}</code>
              <En className="mt-0.5">{t.demoPw.th} · {t.demoPw.en}</En>
            </span>
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
                  onFocus={() => setFocus('id')}
                  onBlur={() => setFocus(null)}
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
                    setPwWrong(false)
                  }}
                  onFocus={() => setFocus('pw')}
                  onBlur={() => setFocus(null)}
                  autoComplete="current-password"
                  aria-invalid={errors.pw || pwWrong || undefined}
                  aria-describedby={errors.pw ? 'login-pw-err' : pwWrong ? 'login-pw-wrong' : undefined}
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
              {pwWrong && (
                <div role="alert">
                  <FieldError
                    id="login-pw-wrong"
                    p={{
                      th: `${t.wrongPw.th} · ${t.wrongPwHint.th} ${DEMO_PASSWORD}`,
                      en: `${t.wrongPw.en}. ${t.wrongPwHint.en} ${DEMO_PASSWORD}.`,
                    }}
                  />
                </div>
              )}
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
              <p className="text-right text-[13px] leading-tight text-tx-3">
                <span className="block">{t.forgot.th}</span>
                <span className="block">{t.forgot.en}</span>
              </p>
            </div>

            <Button type="submit" size="lg" className="w-full">
              <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                <span>{t.login.th}</span> <span className="text-[12.5px] font-medium text-accent-ink/90">{t.login.en}</span>
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
