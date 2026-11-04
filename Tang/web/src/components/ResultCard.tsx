import { useEffect, useState } from 'react'
import { CircleAlert, Download, Moon, Trash2 } from 'lucide-react'
import BoxOverlay from '@/components/BoxOverlay'
import { Button } from '@/components/ui/button'
import { downloadBlob, renderAnnotatedPng } from '@/lib/annotate'
import { meanConfidence, type DetectedImage } from '@/lib/detection'
import { bi, t } from '@/lib/i18n'

export type Photo = { id: string; file: File; result: DetectedImage }

export const pct = (v: number | null) => (v === null ? '-' : `${Math.round(v * 100)}%`)

type Props = { photo: Photo; onRemove: (id: string) => void }

export default function ResultCard({ photo, onRemove }: Props) {
  const { file, result } = photo
  const [src, setSrc] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Own object URL so step 1 can release its thumbnails on unmount.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    // Must be in the effect (not useMemo): StrictMode runs cleanup then setup again, which needs a fresh URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function saveResult() {
    setSaveError(null)
    try {
      const blob = await renderAnnotatedPng(file, result.pipes)
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}-detected.png`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <li data-testid="result-card" className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <span className="truncate font-medium text-gray-800" title={file.name}>
        {file.name}
      </span>
      {src && !result.error && <BoxOverlay src={src} pipes={result.pipes} />}
      {result.error ? (
        <p className="flex items-center gap-1.5 text-red-700">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {result.error}
        </p>
      ) : (
        <p className="flex flex-wrap gap-x-4 text-sm text-gray-700">
          <span className="font-semibold">{bi(t.count(result.count))}</span>
          <span>
            {bi(t.meanConf)}: {pct(meanConfidence(result.pipes))}
          </span>
        </p>
      )}
      {result.brightness === 'dark' && (
        <span className="flex w-fit items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-sm text-amber-900">
          <Moon aria-hidden="true" className="size-4 shrink-0" />
          {bi(t.dark)}
        </span>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-red-700">
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadBlob(file, file.name)}>
          <Download aria-hidden="true" />
          {bi(t.saveOriginal)}
        </Button>
        {!result.error && (
          <Button variant="outline" size="sm" onClick={saveResult}>
            <Download aria-hidden="true" />
            {bi(t.saveResult)}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-red-700" onClick={() => onRemove(photo.id)}>
          <Trash2 aria-hidden="true" />
          {bi(t.removePhoto)}
        </Button>
      </div>
    </li>
  )
}
