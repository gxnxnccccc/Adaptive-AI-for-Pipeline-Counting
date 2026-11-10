import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, CircleDashed, Clock, LoaderCircle, Moon, Sun, X, type LucideIcon } from 'lucide-react'
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
  // Shared upload + detect phase: every ready row shows "Uploading…".
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

const Spinner = () => <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />

function SizeLine({ row }: { row: QueueRow }) {
  const cls = 'font-mono text-sm text-tx-2 tabular-nums'
  const orig = formatBytes(row.original.size)
  if (row.status === 'compressing')
    return (
      <span data-size className={cls}>
        {orig} <span className="text-tx-3">→</span> …
      </span>
    )
  if (!row.prep)
    return (
      <span data-size className={cls}>
        {orig}
      </span>
    )
  const { originalBytes, uploadBytes } = row.prep
  const pct = Math.round((1 - uploadBytes / originalBytes) * 100)
  return (
    <span data-size title={bi(t.sizeTitle)} className={cls}>
      {formatBytes(originalBytes)} <span className="text-tx-3">→</span> {formatBytes(uploadBytes)}
      {pct > 0 && <span className="text-ok"> −{pct}%</span>}
    </span>
  )
}

function Status({ state, row }: { state: RowStatus | 'detecting'; row: QueueRow }) {
  const line = (cls: string, icon: ReactNode, p: Pair) => (
    <span className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm', cls)}>
      {icon}
      <span>{bi(p)}</span>
    </span>
  )
  switch (state) {
    case 'detecting':
      return line('text-accent-hi', <Spinner />, t.stSending)
    case 'done': {
      const n = row.result?.count ?? 0
      return (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold text-ok">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {t.foundPre} <b className="font-mono tabular-nums">{n}</b> {t.foundPost} · {t.count(n).en}
          </span>
        </span>
      )
    }
    case 'failed':
      return (
        <>
          {line('font-semibold text-err', <CircleAlert aria-hidden="true" className="size-4 shrink-0" />, t.failed)}
          {row.error && <span className="text-sm break-words text-err-hi">{row.error}</span>}
        </>
      )
    default:
      // queued / checking / compressing / ready: all wait for the Upload button.
      return line('text-tx-2', <Clock aria-hidden="true" className="size-4 shrink-0" />, t.stWaiting)
  }
}

export default function PhotoRow({ row, running, removeDisabled, onRemove }: Props) {
  const state = running && row.status === 'ready' ? 'detecting' : row.status
  const name = row.original.name
  const showWarnings = row.status !== 'queued' && row.status !== 'checking'
  return (
    <li data-s={state} className={cn('flex items-start gap-3 rounded-card border border-line bg-surface p-3', state === 'failed' && 'border-err/50')}>
      <img src={row.previewUrl} alt="" className="size-16 shrink-0 rounded-lg bg-photo-bg object-cover" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium" title={name}>
          {name}
        </span>
        <SizeLine row={row} />
        <Status state={state} row={row} />
        {showWarnings &&
          warnings(row.prep?.quality).map((w) => (
            <span key={w.label.en} className="flex flex-col items-start gap-0.5">
              <span className="inline-flex items-center gap-1.5 rounded-chip bg-warn/12 px-2 py-1 text-sm text-warn">
                <w.icon aria-hidden="true" className="size-4 shrink-0" />
                {w === WARN.dark ? bi(t.darkNote) : bi(w.label)}
              </span>
              {w !== WARN.dark && <span className="text-sm text-tx-2">{bi(w.hint)}</span>}
            </span>
          ))}
      </div>

      <Button variant="ghost" size="icon" aria-label={bi(t.remove(name))} disabled={removeDisabled} onClick={() => onRemove(row.id)}>
        <X aria-hidden="true" className="size-5" />
      </Button>
    </li>
  )
}
