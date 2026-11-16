import { t } from '@/lib/i18n'

// SPDS logo (three pipe ends, one counted in pink) and wordmark. The parent sets the flex layout
// (AppShell wraps it in a home link, Login in a plain div). Subtitle = Thai line + English line,
// so it never wraps mid-phrase in the 248 px sidebar.
export default function BrandMark({ withSub = true, onDark = false }: { withSub?: boolean; onDark?: boolean }) {
  return (
    <>
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-9 shrink-0">
        <rect width="40" height="40" rx="11" className={onDark ? 'fill-surface' : 'fill-accent'} />
        <circle cx="14" cy="25" r="6" className={onDark ? 'fill-accent' : 'fill-surface'} />
        <circle cx="26" cy="25" r="6" className={onDark ? 'fill-accent' : 'fill-surface'} />
        <circle cx="20" cy="14.5" r="6" className="fill-pink" />
      </svg>
      <span className="flex flex-col">
        <b className={`font-display text-lg leading-none font-semibold tracking-[.06em] ${onDark ? 'text-surface' : 'text-accent'}`}>
          SPDS
        </b>
        {withSub && (
          <span className={`mt-1 flex flex-col text-[12.5px] leading-tight ${onDark ? 'text-surface/80' : 'text-tx-3'}`}>
            <span>{t.brandSub.th}</span>
            <span>{t.brandSub.en}</span>
          </span>
        )}
      </span>
    </>
  )
}
