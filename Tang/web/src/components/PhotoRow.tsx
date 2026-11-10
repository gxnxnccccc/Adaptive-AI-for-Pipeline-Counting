import type { ReactNode } from 'react'
import { Check, CircleAlert, CircleCheck, CircleDashed, Clock, LoaderCircle, Moon, Sun, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/compress'
import type { DetectedImage } from '@/lib/detection'
import { bi, t, type Pair } from '@/lib/i18n'
import type { Prepared } from '@/lib/prepare'
import type { Quality } from '@/lib/quality'
import { cn } from '@/lib/utils'

export type RowStatus = 'queued' | 'checking' | 'compressing' | 'ready' | 'done' | 'failed'

export type QueueRow = {
  id: string
  original: File
  previewUrl: string
  status: RowStatus
  prep?: Prepared
  result?: DetectedImage
  error?: string
}

type Props = {
  row: QueueRow
  // Shared upload + detect phase: every ready row shows "Uploading & detecting…".
  running: boolean
  removeDisabled: boolean
  onRemove: (id: string) => void
}

type Warning = { icon: LucideIcon; label: Pair; hint: Pair }
const WARN = {
  dark: { icon: Moon, label: t.qDark, hint: t.qDarkHint },
  bright: { icon: Sun, label: t.qBright, hint: t.qBrightHint },
  blurry: { icon: CircleDashed, label: t.qBlurry, hint: t.qBlurryHint },
} satisfies Record<string, Warning>

export function warnings(q: Quality | undefined): Warning[] {
  if (!q) return []
  const out: Warning[] = []
  if (q.brightness !== 'ok') out.push(WARN[q.brightness])
  if (q.blur === 'blurry') out.push(WARN.blurry)
  return out
}

const En = ({ children }: { children: ReactNode }) => <span className="text-[12.5px] font-normal opacity-85">{children}</span>
const Spinner = () => <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
const IndBar = () => (
  <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-[3px] bg-raised">
    <i className="block h-full w-[35%] animate-ind rounded-[3px] bg-accent motion-reduce:animate-none" />
  </div>
)

function SizeLine({ row }: { row: QueueRow }) {
  const orig = formatBytes(row.original.size)
  if (row.status === 'compressing')
    return (
      <span data-size className="font-mono text-[13px] whitespace-nowrap text-tx-2 tabular-nums">
        {orig} <span className="text-tx-3">→</span> …
      </span>
    )
  if (!row.prep)
    return (
      <span data-size className="font-mono text-[13px] whitespace-nowrap text-tx-2 tabular-nums">
        {orig}
      </span>
    )
  const { originalBytes, uploadBytes } = row.prep
  const pct = Math.round((1 - uploadBytes / originalBytes) * 100)
  return (
    <span data-size title={bi(t.sizeTitle)} className="font-mono text-[13px] whitespace-nowrap text-tx-2 tabular-nums">
      {formatBytes(originalBytes)} <span className="text-tx-3">→</span> {formatBytes(uploadBytes)}
      {pct > 0 && <span className="text-ok"> −{pct}%</span>}
    </span>
  )
}

function Status({ state, row }: { state: RowStatus | 'detecting'; row: QueueRow }) {
  const line = (cls: string, icon: ReactNode, p: Pair) => (
    <span className={cn('flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold', cls)}>
      {icon}
      <span>{p.th}</span>
      <En>{p.en}</En>
    </span>
  )
  switch (state) {
    case 'queued':
      return line('text-tx-2', <Clock aria-hidden="true" className="size-4 shrink-0" />, t.stQueued)
    case 'checking':
      return line('text-tx-2', <Spinner />, t.stChecking)
    case 'compressing':
      return (
        <>
          {line('text-tx-2', <Spinner />, t.stCompressing)}
          <IndBar />
        </>
      )
    case 'ready':
      return line('text-accent', <Check aria-hidden="true" className="size-4 shrink-0" />, t.stReady)
    case 'detecting':
      return (
        <>
          {line('text-accent', <Spinner />, t.stRunning)}
          <IndBar />
        </>
      )
    case 'done': {
      const n = row.result?.count ?? 0
      return (
        <span className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ok">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {t.foundPre} <b className="font-mono text-[22px] leading-none tabular-nums">{n}</b> {t.foundPost}
          </span>
          <En>{t.count(n).en}</En>
        </span>
      )
    }
    case 'failed':
      return (
        <>
          {line('text-err', <CircleAlert aria-hidden="true" className="size-4 shrink-0" />, t.failed)}
          {row.error && <span className="text-[13px] break-words text-err-hi">{row.error}</span>}
        </>
      )
  }
}

export default function PhotoRow({ row, running, removeDisabled, onRemove }: Props) {
  const state = running && row.status === 'ready' ? 'detecting' : row.status
  const name = row.original.name
  const showWarnings = row.status !== 'queued' && row.status !== 'checking'
  return (
    <li
      data-s={state}
      className={cn(
        'grid grid-cols-[64px_minmax(0,1fr)_44px] items-start gap-2.5 rounded-control border border-line bg-bg/55 p-2.5 min-[640px]:grid-cols-[76px_minmax(0,1fr)_44px] min-[640px]:gap-3 min-[1100px]:grid-cols-[104px_minmax(0,1fr)_44px]',
        state === 'failed' && 'border-err/50',
        state === 'done' && 'border-ok/35',
        state === 'detecting' && 'border-accent/55 shadow-[0_0_0_1px_rgb(34_211_238/0.15),0_0_24px_rgb(34_211_238/0.08)]',
      )}
    >
      <div className="relative aspect-4/3 overflow-hidden rounded-lg border border-line bg-photo-bg">
        <img src={row.previewUrl} alt="" className="size-full object-cover" />
        {state === 'detecting' && (
          <span
            data-scan
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[30%] animate-scan bg-linear-to-b from-transparent via-accent/28 via-85% to-accent-hi/95 motion-reduce:top-auto motion-reduce:bottom-0 motion-reduce:h-[3px] motion-reduce:animate-none motion-reduce:bg-accent motion-reduce:bg-none"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="max-w-full truncate font-mono text-sm font-semibold" title={name}>
            {name}
          </span>
          <SizeLine row={row} />
        </div>
        <Status state={state} row={row} />
        {showWarnings &&
          warnings(row.prep?.quality).map((w) => (
            <div key={w.label.en} className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-warn/40 bg-warn/12 px-2.5 py-0.5 text-[13px] leading-tight font-semibold whitespace-nowrap text-warn">
                <w.icon aria-hidden="true" className="size-4 shrink-0" />
                <span>{w.label.th}</span>
                <span className="text-xs font-normal opacity-85">{w.label.en}</span>
              </span>
              <span className="text-[13px] text-tx-2">
                {w.hint.th} · <span className="text-tx-3">{w.hint.en}</span>
              </span>
            </div>
          ))}
      </div>

      <Button variant="ghost" size="icon" aria-label={bi(t.remove(name))} disabled={removeDisabled} onClick={() => onRemove(row.id)}>
        <X aria-hidden="true" className="size-5" />
      </Button>
    </li>
  )
}
