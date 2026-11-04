import { bi, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STEPS = [t.step1, t.stepDetect, t.stepConfirm]

export default function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol data-testid="stepper" aria-label={bi(t.stepper)} className="flex gap-2">
      {STEPS.map((s, i) => {
        const n = i + 1
        const active = n === current
        return (
          <li
            key={n}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex min-h-11 flex-1 flex-col items-center justify-center rounded-lg px-1 text-center text-xs',
              active ? 'bg-blue-600 font-bold text-white' : n < current ? 'bg-blue-100 text-blue-900' : 'bg-gray-200 text-gray-700',
            )}
          >
            <span>
              {n}. {s.th}
            </span>
            <span className="font-normal">{s.en}</span>
          </li>
        )
      })}
    </ol>
  )
}
