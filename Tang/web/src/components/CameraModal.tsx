import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CameraOff, Images, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// asking -> live | denied (NotAllowedError) | none (NotFoundError, other errors, or no mediaDevices)
type CamState = 'asking' | 'live' | 'denied' | 'none'

type Props = {
  onShots: (files: File[]) => void // Done with at least 1 shot; the parent closes the modal
  onClose: () => void // X, Esc, or Done with 0 shots (shots taken so far are dropped, as in the preview)
  onPickInstead: () => void // denied / no camera: close and open the normal photo picker
}

// Plain http on a phone has no navigator.mediaDevices (secure context only).
export const canUseLiveCamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const JPEG_QUALITY = 0.92
const stopAll = (s: MediaStream | null) => s?.getTracks().forEach((tr) => tr.stop())

const En = ({ children }: { children: ReactNode }) => (
  <span className="text-[12.5px] font-normal tracking-[.01em] text-tx-3">{children}</span>
)
const Bi = ({ p }: { p: Pair }) => (
  <span className="flex flex-col leading-tight">
    <span>{p.th}</span>
    <En>{p.en}</En>
  </span>
)

function Message({ icon, tone, title, hint, role }: { icon: ReactNode; tone: string; title: Pair; hint: Pair; role: 'status' | 'alert' }) {
  return (
    <div
      role={role}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_40%,#111a2b,#03060c)] p-6 text-center"
    >
      <span className={cn('mb-1.5 grid size-16 place-items-center rounded-full', tone)}>{icon}</span>
      <h3 className="flex flex-col text-lg font-semibold">
        <span>{title.th}</span>
        <En>{title.en}</En>
      </h3>
      <p className="flex max-w-[380px] flex-col text-sm text-tx-2">
        <span>{hint.th}</span>
        <span className="text-[12.5px] text-tx-3">{hint.en}</span>
      </p>
      {role === 'status' && (
        <span aria-hidden="true" className="mt-1.5 size-[22px] rounded-full border-2 border-accent/30 border-t-accent motion-safe:animate-spin" />
      )}
    </div>
  )
}

export default function CameraModal({ onShots, onClose, onPickInstead }: Props) {
  const [state, setState] = useState<CamState>(() => (canUseLiveCamera() ? 'asking' : 'none'))
  const [attempt, setAttempt] = useState(0)
  const [shots, setShots] = useState<File[]>([])
  const [thumb, setThumb] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const shutterRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const thumbRef = useRef<string | null>(null)

  // Open the stream; every exit path (close, Done, unmount, route change) runs the cleanup and stops the tracks.
  useEffect(() => {
    if (!canUseLiveCamera()) return
    let cancelled = false
    let stream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(
      (s) => {
        if (cancelled) return stopAll(s) // closed while the browser prompt was open
        stream = s
        const v = videoRef.current
        if (v) {
          v.srcObject = s
          v.play?.()?.catch(() => {}) // autoPlay covers it; play() can reject if interrupted
        }
        setState('live')
      },
      (e: unknown) => {
        if (cancelled) return
        const name = e instanceof Error || e instanceof DOMException ? e.name : ''
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'none')
      },
    )
    return () => {
      cancelled = true
      stopAll(stream)
    }
  }, [attempt])

  // Focus goes back to whatever opened the modal (the Open camera button).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => {
      opener?.focus?.()
      if (thumbRef.current) URL.revokeObjectURL(thumbRef.current)
    }
  }, [])

  // Same as the preview: shutter when live, otherwise the close button.
  useEffect(() => {
    ;(state === 'live' ? shutterRef : closeRef).current?.focus()
  }, [state])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    // Focus trap: wrap Tab / Shift+Tab inside the dialog.
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  async function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth || !v.videoHeight) return // no frame yet
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY))
    if (!blob) return
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current)
    thumbRef.current = URL.createObjectURL(file)
    setThumb(thumbRef.current)
    setShots((prev) => [...prev, file])
    setFlash((n) => n + 1)
  }

  const done = () => (shots.length ? onShots(shots) : onClose())
  const retry = () => {
    setState('asking')
    setAttempt((n) => n + 1)
  }
  const taken = t.camTaken(shots.length)

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-bg/80 p-4 backdrop-blur-sm max-sm:p-0">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cam-title"
        data-cam={state}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-[min(760px,calc((100dvh_-_230px)_*_1.333))] flex-col rounded-card border border-line bg-surface shadow-[0_24px_60px_rgb(0_0_0/0.6)] max-sm:h-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
      >
        <div className="flex items-start gap-3 px-[18px] pt-[18px] max-sm:px-3 max-sm:pt-3">
          <h2 id="cam-title" className="flex flex-col text-lg leading-tight font-bold">
            <span>{t.camTitle.th}</span>
            <En>{t.camTitle.en}</En>
          </h2>
          <Button ref={closeRef} variant="ghost" size="icon" className="ml-auto" aria-label={bi(t.camClose)} onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <div className="relative mx-[18px] mt-3 aspect-4/3 overflow-hidden rounded-control border border-line bg-black max-sm:mx-2 max-sm:mt-2 max-sm:aspect-auto max-sm:flex-1">
          {/* Always mounted so the stream can attach as soon as it arrives. */}
          <video
            ref={videoRef}
            data-testid="cam-video"
            autoPlay
            playsInline
            muted
            aria-hidden="true"
            className={cn('absolute inset-0 size-full object-cover', state !== 'live' && 'invisible')}
          />
          {state === 'live' && (
            <>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-[7%] inset-y-[9%]">
                <i className="absolute top-0 left-0 size-7 border-t-3 border-l-3 border-accent" />
                <i className="absolute top-0 right-0 size-7 border-t-3 border-r-3 border-accent" />
                <i className="absolute bottom-0 left-0 size-7 border-b-3 border-l-3 border-accent" />
                <i className="absolute right-0 bottom-0 size-7 border-r-3 border-b-3 border-accent" />
              </div>
              <span className="absolute top-2.5 left-2.5 inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-ok/40 bg-ok/12 px-2.5 py-0.5 text-[13px] font-semibold text-ok">
                <span aria-hidden="true" className="size-2 rounded-full bg-current motion-safe:animate-api-pulse" />
                <span>{t.camLive.th}</span>
                <span className="text-xs font-normal opacity-85">{t.camLive.en}</span>
              </span>
              <span className="absolute bottom-3 left-1/2 max-w-[92%] -translate-x-1/2 rounded-full border border-line bg-bg/85 px-3 py-1.5 text-center text-[13px]">
                {t.camHint.th} · <span className="text-tx-3">{t.camHint.en}</span>
              </span>
              {/* White flash per shot; no flash under reduced motion. */}
              {flash > 0 && (
                <div
                  key={flash}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-white opacity-0 duration-350 ease-out motion-safe:animate-in motion-safe:fade-in-85"
                />
              )}
            </>
          )}
          {state === 'asking' && (
            <Message
              role="status"
              tone="bg-accent/12 text-accent"
              icon={<ShieldCheck aria-hidden="true" className="size-8" />}
              title={t.camAsking}
              hint={t.camAskingHint}
            />
          )}
          {state === 'denied' && (
            <Message
              role="alert"
              tone="bg-err/12 text-err"
              icon={<CameraOff aria-hidden="true" className="size-8" />}
              title={t.camDenied}
              hint={t.camDeniedHint}
            />
          )}
          {state === 'none' && (
            <Message
              role="alert"
              tone="bg-raised text-tx-2"
              icon={<CameraOff aria-hidden="true" className="size-8" />}
              title={t.camNone}
              hint={t.camNoneHint}
            />
          )}
        </div>

        {state === 'live' && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-[18px] pt-3.5 pb-[18px] max-sm:px-3 max-sm:pb-[calc(14px+env(safe-area-inset-bottom))]">
            <div data-testid="cam-taken" aria-live="polite" className="flex min-w-0 items-center gap-2 text-sm">
              {shots.length > 0 ? (
                <>
                  {thumb && <img src={thumb} alt="" className="h-[33px] w-11 shrink-0 rounded-md border border-line-2 object-cover" />}
                  <Bi p={taken} />
                </>
              ) : (
                <En>{bi(t.camNoneYet)}</En>
              )}
            </div>
            <button
              ref={shutterRef}
              type="button"
              aria-label={bi(t.camCapture)}
              onClick={capture}
              className="group grid size-[72px] cursor-pointer place-items-center rounded-full border-4 border-tx bg-transparent p-0"
            >
              <span
                aria-hidden="true"
                className="size-[54px] rounded-full bg-tx transition-transform duration-100 group-active:scale-90 motion-reduce:transition-none"
              />
            </button>
            <Button variant="secondary" className="justify-self-end" onClick={done}>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span>{t.camDone.th}</span>
                <span className="text-[12.5px] font-normal text-tx-3">{t.camDone.en}</span>
              </span>
            </Button>
          </div>
        )}

        {(state === 'denied' || state === 'none') && (
          <div className="flex flex-wrap justify-end gap-2 px-[18px] pt-2 pb-[18px] max-sm:px-3 max-sm:pb-[calc(14px+env(safe-area-inset-bottom))]">
            {state === 'denied' && (
              <Button variant="secondary" onClick={retry}>
                <RefreshCw aria-hidden="true" className="size-5" />
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span>{t.tryAgain.th}</span>
                  <span className="text-[12.5px] font-normal text-tx-3">{t.tryAgain.en}</span>
                </span>
              </Button>
            )}
            <Button onClick={onPickInstead}>
              <Images aria-hidden="true" className="size-5" />
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span>{t.camPickInstead.th}</span>
                <span className="text-[12.5px] font-medium text-accent-ink/75">{t.camPickInstead.en}</span>
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
