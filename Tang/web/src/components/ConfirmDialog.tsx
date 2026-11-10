import { useEffect, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Pair } from '@/lib/i18n'

type Props = {
  title: Pair
  body: Pair
  yes: Pair
  no: Pair
  onYes: () => void
  onNo: () => void
}

const En = ({ children }: { children: string }) => <span className="text-[12.5px] font-medium opacity-75">{children}</span>

// Yes/No alertdialog (preview .overlay + .dialog). "No" gets focus, Esc = No, Tab stays inside,
// focus goes back to the opener on close.
export default function ConfirmDialog({ title, body, yes, no, onYes, onNo }: Props) {
  const noRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    noRef.current?.focus()
    return () => opener?.focus?.()
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onNo()
      return
    }
    if (e.key !== 'Tab' || !boxRef.current) return
    const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
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

  return createPortal(
    <div
      data-testid="dialog-backdrop"
      // A click on the backdrop must not move focus to <body> (Esc + Tab trap would stop working).
      onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-bg/78 p-4 backdrop-blur-[3px]"
    >
      <div
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-body"
        onKeyDown={onKeyDown}
        // Text inside the box is not focusable: without this a mousedown on it moves focus to <body>.
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest('button, input, a, select, textarea')) e.preventDefault()
        }}
        className="w-full max-w-[440px] rounded-card border border-line-2 bg-surface shadow-[0_24px_60px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start gap-3 px-[18px] pt-[18px]">
          <TriangleAlert aria-hidden="true" className="size-7 shrink-0 text-err" />
          <h2 id="cd-title" className="flex flex-col text-lg leading-snug font-bold">
            <span>{title.th}</span>
            <span className="text-[12.5px] font-normal text-tx-3">{title.en}</span>
          </h2>
        </div>
        <p id="cd-body" className="flex flex-col px-[18px] py-3 text-[15px] text-tx-2">
          <span>{body.th}</span>
          <span className="text-[12.5px] text-tx-3">{body.en}</span>
        </p>
        <div className="flex flex-wrap justify-end gap-2 px-[18px] pt-2 pb-[18px]">
          <Button ref={noRef} variant="secondary" className="whitespace-normal" onClick={onNo}>
            <span>{no.th}</span>
            <En>{no.en}</En>
          </Button>
          <Button className="bg-err text-accent-ink whitespace-normal hover:bg-err/85" onClick={onYes}>
            <span>{yes.th}</span>
            <En>{yes.en}</En>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
