import { CircleAlert, Pencil } from 'lucide-react'
import PhotoViewer from '@/components/PhotoViewer'
import { correctedCount, hasEdits, type PhotoEdits } from '@/lib/corrections'
import type { SessionPhoto } from '@/lib/detection-session'
import { bi, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Props = {
  photos: SessionPhoto[]
  edits: Record<string, PhotoEdits>
  // Object URL of each photo's upload file, by photo id.
  urls: Record<string, string>
  selectedId: string
  onSelect: (id: string) => void
}

// "All photos" strip on Result (preview .strip): crop thumbnail with the corrected boxes, count chip, edited badge.
export default function PhotoStrip({ photos, edits, urls, selectedId, onSelect }: Props) {
  return (
    <div className="px-4 pb-4">
      <span className="font-mono text-xs font-medium tracking-[.08em] text-tx-3 uppercase">{bi(t.allPhotos)}</span>
      <ul className="m-0 mt-2 flex list-none snap-x snap-proximity gap-2.5 overflow-x-auto p-0.5">
        {photos.map((p) => {
          const failed = !!p.result.error
          const e = edits[p.id]
          const edited = !failed && hasEdits(e)
          const n = correctedCount(p.result.count, e)
          const label = [p.original.name, failed ? bi(t.failedShort) : `${n} ${bi(t.pipesUnit)}`, edited && bi(t.edited)]
            .filter(Boolean)
            .join(', ')
          return (
            <li key={p.id} className="snap-start">
              <button
                type="button"
                aria-pressed={p.id === selectedId}
                aria-label={label}
                data-testid="strip-thumb"
                onClick={() => onSelect(p.id)}
                className="flex w-[136px] flex-none cursor-pointer flex-col gap-1.5 rounded-control border border-line bg-surface p-1.5 text-left text-tx hover:border-line-2 aria-pressed:border-accent aria-pressed:shadow-[0_0_0_1px_var(--color-accent)]"
              >
                <span className="relative block aspect-[4/3] overflow-hidden rounded-md bg-photo-bg">
                  {urls[p.id] && (
                    <PhotoViewer
                      src={urls[p.id]}
                      width={p.width}
                      height={p.height}
                      pipes={p.result.pipes}
                      edits={e}
                      cropBox={p.result.cropBox}
                      readOnly
                    />
                  )}
                  {failed && <span aria-hidden="true" className="absolute inset-0 bg-err/40" />}
                  {edited && (
                    <span
                      data-testid="edited-badge"
                      aria-hidden="true"
                      className="absolute top-1 right-1 grid size-[22px] place-items-center rounded-full bg-ok text-accent-ink"
                    >
                      <Pencil className="size-[13px]" strokeWidth={2.5} />
                    </span>
                  )}
                </span>
                <span className="flex min-h-[30px] items-center justify-between gap-1 text-[12.5px]">
                  <span className="truncate font-mono">{p.original.name.replace(/\.[^.]+$/, '')}</span>
                  <span
                    className={cn(
                      'inline-flex min-h-[26px] shrink-0 items-center gap-1 rounded-full border px-2 font-mono',
                      failed ? 'border-err/40 bg-err/12 text-err' : 'border-line bg-raised',
                    )}
                  >
                    {failed ? (
                      <>
                        <CircleAlert aria-hidden="true" className="size-3.5" />
                        <span className="font-sans">{t.failedShort.th}</span>
                      </>
                    ) : (
                      n
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
