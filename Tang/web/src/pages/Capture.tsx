import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Upload } from 'lucide-react'
import DropZone from '@/components/DropZone'
import ImageList, { type UploadItem } from '@/components/ImageList'
import StepCard from '@/components/StepCard'
import { Button } from '@/components/ui/button'
import { uploadImages } from '@/lib/api'
import { toDetectedImages, type DetectedImage } from '@/lib/detection'
import { bi, t } from '@/lib/i18n'

// Mirrors api/app/config.py (max_files_per_request, max_file_bytes). Change both together.
const MAX_FILES = 10
const MAX_FILE_MB = 15
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

export type CaptureDone = { batchId: string; photos: { id: string; file: File; result: DetectedImage }[] }

type Props = {
  operatorId?: string
  // Called once after an upload request succeeds, with every photo that has a result.
  onDone?: (done: CaptureDone) => void
}

export default function Capture({ operatorId, onDone }: Props = {}) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [notices, setNotices] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  // Every thumbnail URL still alive; revoked on remove and on unmount.
  const urls = useRef(new Set<string>())
  useEffect(() => {
    const live = urls.current
    return () => {
      live.forEach((u) => URL.revokeObjectURL(u))
      live.clear()
    }
  }, [])

  function addFiles(files: File[]) {
    const msgs: string[] = []
    const ok: File[] = []
    for (const f of files) {
      // `accept` is not enforced on drag and drop, so check here too.
      if (!f.type.startsWith('image/')) msgs.push(bi(t.notImage(f.name)))
      else if (f.size > MAX_FILE_BYTES) msgs.push(bi(t.tooBig(f.name, MAX_FILE_MB)))
      else ok.push(f)
    }
    const room = Math.max(MAX_FILES - items.length, 0)
    if (ok.length > room) msgs.push(bi(t.tooMany(MAX_FILES)))

    const added: UploadItem[] = ok.slice(0, room).map((file) => {
      const previewUrl = URL.createObjectURL(file)
      urls.current.add(previewUrl)
      return { id: crypto.randomUUID(), file, previewUrl, status: 'queued' }
    })
    setItems((prev) => [...prev, ...added])
    setNotices(msgs)
  }

  function remove(id: string) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    URL.revokeObjectURL(item.previewUrl)
    urls.current.delete(item.previewUrl)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setNotices([])
  }

  // Sends queued items, and failed ones again (retry after a network error).
  const pending = items.filter((i) => i.status === 'queued' || i.status === 'failed')

  async function upload() {
    if (pending.length === 0) return
    const ids = new Set(pending.map((i) => i.id))
    setBusy(true)
    setItems((prev) => prev.map((i) => (ids.has(i.id) ? { ...i, status: 'uploading', error: undefined } : i)))
    try {
      const resp = await uploadImages(
        pending.map((i) => i.file),
        operatorId,
      )
      const results = toDetectedImages(resp)
      // The API answers in the same order the files were sent.
      const byId = new Map(pending.map((i, n) => [i.id, results[n]]))
      setItems((prev) =>
        prev.map((i) => {
          if (!ids.has(i.id)) return i
          const r = byId.get(i.id)
          if (!r) return { ...i, status: 'failed', error: bi(t.noResult) }
          if (r.error) return { ...i, status: 'failed', error: r.error, result: r }
          return { ...i, status: 'done', result: r }
        }),
      )
      onDone?.({
        batchId: resp.batch_id,
        photos: pending.flatMap((i, n) => (results[n] ? [{ id: i.id, file: i.file, result: results[n] }] : [])),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setItems((prev) => prev.map((i) => (ids.has(i.id) ? { ...i, status: 'failed', error: msg } : i)))
    } finally {
      setBusy(false)
    }
  }

  const buttonLabel = busy ? t.uploadingAll : pending.length ? t.upload(pending.length) : t.allUploaded

  return (
    <div className="flex flex-col gap-4">
      <StepCard step={1} title={t.step1.th} subtitle={t.step1.en}>
        <DropZone onFiles={addFiles} disabled={busy} />
        <p className="text-sm text-gray-600">
          {bi(t.limits(MAX_FILES, MAX_FILE_MB))} ({items.length}/{MAX_FILES})
        </p>
        {notices.length > 0 && (
          <div role="alert" className="flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {notices.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
        <ImageList items={items} onRemove={remove} disabled={busy} />
      </StepCard>

      {items.length > 0 && (
        // Sticky at the bottom so the main action stays in thumb reach on a phone.
        <div className="sticky bottom-0 -mx-4 bg-gray-50/95 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-transparent sm:p-0">
          <Button
            size="lg"
            className="w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            disabled={busy || pending.length === 0}
            onClick={upload}
          >
            {busy ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Upload aria-hidden="true" />}
            {bi(buttonLabel)}
          </Button>
        </div>
      )}
    </div>
  )
}
