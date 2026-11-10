import { useEffect, useState } from 'react'
import { CircleCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bi, t, type Pair } from '@/lib/i18n'

export const TOAST_MS = 5_000

// mono: a part of the text (e.g. the DO number) set in the mono font.
type Message = Pair & { mono?: string }

type Props = {
  // null = nothing to show. Pass a stable value (useMemo): a new object restarts the timer.
  message: Message | null
  onClose: () => void
}

// Green success toast (preview .toast): top-right, ✕, auto-closes after 5 s.
// The live region is always mounted; the text goes in one render after it, so screen readers announce it
// even when the page mounts with a message (Result -> Processing after a submit).
// "Saved DO DX1" -> "Saved DO <span mono>DX1</span>"
function withMono(text: string, mono?: string) {
  if (!mono) return text
  const at = text.indexOf(mono) // first occurrence only
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <span className="font-mono tabular-nums">{mono}</span>
      {text.slice(at + mono.length)}
    </>
  )
}

export default function Toast({ message, onClose }: Props) {
  const [shown, setShown] = useState<Message | null>(null)

  useEffect(() => {
    // Second render on purpose: the empty region must be in the DOM before the text arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(message)
  }, [message])

  useEffect(() => {
    if (!message) return
    const id = setTimeout(onClose, TOAST_MS)
    return () => clearTimeout(id)
  }, [message, onClose])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed top-[70px] right-4 left-4 z-50 ml-auto max-w-[420px]">
      {shown && (
        <div
          data-testid="saved-toast"
          className="pointer-events-auto flex items-center gap-3 rounded-control border border-ok/55 bg-ok-surface py-3 pr-2 pl-3.5 shadow-[0_16px_40px_rgb(0_0_0/0.5)] animate-in fade-in slide-in-from-top-2"
        >
          <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-ok" />
          <p className="flex min-w-0 flex-1 flex-col font-semibold">
            <span>{withMono(shown.th, shown.mono)}</span>
            <span className="text-[12.5px] font-normal text-tx-3">{withMono(shown.en, shown.mono)}</span>
          </p>
          <Button variant="ghost" size="icon" aria-label={bi(t.close)} onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
      )}
    </div>
  )
}
