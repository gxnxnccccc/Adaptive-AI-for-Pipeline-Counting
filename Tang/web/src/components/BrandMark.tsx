import { bi, t } from '@/lib/i18n'

// SPDS logo (pipe stack + cyan corner guides) and wordmark. The parent sets the flex layout
// (AppShell wraps it in a home link, Login in a plain div).
export default function BrandMark({ withSub = true }: { withSub?: boolean }) {
  return (
    <>
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-9 shrink-0 fill-none">
        <rect x=".5" y=".5" width="39" height="39" rx="9" className="fill-surface stroke-line" />
        <circle cx="14.5" cy="24.5" r="5.5" strokeWidth="2" className="stroke-tx-2" />
        <circle cx="25.5" cy="24.5" r="5.5" strokeWidth="2" className="stroke-tx-2" />
        <circle cx="20" cy="15" r="5.5" strokeWidth="2" className="stroke-accent" />
        <path d="M6 11V6h5M34 11V6h-5M6 29v5h5M34 29v5h-5" strokeWidth="1.6" strokeLinecap="round" className="stroke-accent" />
      </svg>
      <span className="flex flex-col">
        <b className="font-mono text-lg leading-tight tracking-[.14em]">SPDS</b>
        {withSub && <span className="text-[12.5px] font-normal tracking-[.01em] text-tx-3">{bi(t.brandSub)}</span>}
      </span>
    </>
  )
}
