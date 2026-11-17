import { useId, useState } from 'react'
import { ChevronDown, CircleCheck, CircleX, Lightbulb } from 'lucide-react'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Kind = 'good' | 'angle' | 'dark' | 'blocked'

// 5-4-3 stack of pipe ends, the same picture for every example; each bad example changes one thing.
const ROWS = [5, 4, 3]
const R = 9
function Stack({ kind }: { kind: Kind }) {
  const ends = ROWS.flatMap((n, row) =>
    Array.from({ length: n }, (_, i) => ({ cx: 60 - (n - 1) * R + i * 2 * R, cy: 70 - row * 17 })),
  )
  // Angle: ends squashed into ovals and sheared, like a side-on shot.
  // Blocked: the stack slides out of frame on the right and a post covers part of it.
  const move =
    kind === 'angle' ? 'translate(60 55) skewY(-12) scale(.55 1) translate(-60 -55)' : kind === 'blocked' ? 'translate(34 0)' : undefined
  return (
    <svg viewBox="0 0 120 90" aria-hidden="true" className="block h-auto w-full">
      <rect width="120" height="90" fill="#cfd8e8" />
      <rect y="79" width="120" height="11" fill="#a9b4c8" />
      <g transform={move}>
        {ends.map((e, i) => (
          <g key={i}>
            <circle cx={e.cx} cy={e.cy} r={R - 0.5} fill="#8a94a6" stroke="#3b4458" strokeWidth="1.6" />
            <circle cx={e.cx} cy={e.cy} r={R - 3.5} fill="#2b3242" />
          </g>
        ))}
      </g>
      {kind === 'blocked' && <rect x="40" y="18" width="22" height="72" rx="3" fill="#5b4636" />}
      {kind === 'dark' && <rect width="120" height="90" fill="#05070d" opacity=".72" />}
    </svg>
  )
}

const EXAMPLES: { kind: Kind; text: Pair }[] = [
  { kind: 'good', text: t.tipGood },
  { kind: 'angle', text: t.tipAngle },
  { kind: 'dark', text: t.tipDark },
  { kind: 'blocked', text: t.tipBlocked },
]

// Pre-capture guidance (P1): one good and three bad example shots + 3 short rules.
// Phone: a closed bar above the capture card (tap to open). Wide screens: starts open, in the right column.
const WIDE = '(min-width: 1180px)'
export default function PhotoTips() {
  const [open, setOpen] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches)
  const id = useId()
  return (
    <aside aria-labelledby={`${id}-h`} data-testid="photo-tips" className="rounded-card border border-line bg-surface shadow-card min-[1180px]:sticky min-[1180px]:top-4">
      <h2 id={`${id}-h`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left"
        >
          <Lightbulb aria-hidden="true" className="size-5 shrink-0 text-pink-ink" />
          <span className="flex flex-1 flex-col leading-tight">
            <span className="text-base font-bold">{t.tipsTitle.th}</span>
            <span className="text-[12.5px] font-normal text-tx-3">{t.tipsTitle.en}</span>
          </span>
          <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-tx-3 motion-safe:transition-transform', open && 'rotate-180')} />
        </button>
      </h2>
      {open && (
        <div id={`${id}-body`} className="flex flex-col gap-3 px-4 pb-4">
          <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
            {EXAMPLES.map(({ kind, text }) => {
              const good = kind === 'good'
              const Icon = good ? CircleCheck : CircleX
              return (
                <li key={kind} data-testid={`tip-${kind}`}>
                  <figure className={cn('m-0 overflow-hidden rounded-lg border-2', good ? 'border-ok' : 'border-err/60')}>
                    <div className="relative">
                      <Stack kind={kind} />
                      <span className={cn('absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-surface', good ? 'text-ok' : 'text-err')}>
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                    </div>
                    <figcaption className="flex flex-col px-2 py-1.5 text-[13px] leading-snug">
                      <span className={cn('font-semibold', good ? 'text-ok' : 'text-err')}>
                        <span className="sr-only">{bi(good ? t.tipDo : t.tipDont)}: </span>
                        {text.th}
                      </span>
                      <span className="text-xs text-tx-3">{text.en}</span>
                    </figcaption>
                  </figure>
                </li>
              )
            })}
          </ul>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-tx-2 marker:text-pink-ink">
            {[t.tipRuleFrame, t.tipRuleFace, t.tipRuleSteady].map((r) => (
              <li key={r.en}>
                {r.th} <span className="text-xs text-tx-3">{r.en}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
