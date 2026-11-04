import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { MAX_DO, MAX_NOTES, formatVariance, parseActual, validateConfirm, variance } from '@/lib/confirm'
import { bi, t } from '@/lib/i18n'

const input = 'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base'

export type ConfirmSubmit = { doNumber: string; actualAmount: number; notes: string }

type Props = {
  modelTotal: number
  // Rejects with the API message on failure; the form keeps its data.
  onSubmit: (values: ConfirmSubmit) => Promise<void>
  onCancel: () => void
  onBack: () => void
}

export default function ConfirmForm({ modelTotal, onSubmit, onCancel, onBack }: Props) {
  const [doNumber, setDoNumber] = useState('')
  const [actual, setActual] = useState(String(modelTotal))
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false) // blocks a second submit before React re-renders

  const errors = validateConfirm({ doNumber, actual, notes })
  const valid = Object.keys(errors).length === 0
  const actualNum = parseActual(actual)
  const diff = actualNum === null ? null : variance(actualNum, modelTotal)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid || actualNum === null || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ doNumber: doNumber.trim(), actualAmount: actualNum, notes: notes.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const fieldError = (show: boolean, msg: string) =>
    show && (
      <span role="alert" className="text-sm text-red-700">
        {msg}
      </span>
    )

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="rounded-xl bg-blue-50 p-3">
        <div className="text-sm text-gray-700">{bi(t.detected)}</div>
        <div data-testid="model-total" className="text-3xl font-bold text-blue-700">
          {modelTotal}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {bi(t.doNumber)} *
        <input className={input} value={doNumber} maxLength={MAX_DO} onChange={(e) => setDoNumber(e.target.value)} />
        {fieldError(touched && !!errors.doNumber, bi(t.doRequired))}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {bi(t.actualAmount)} *
        <input className={input} inputMode="numeric" value={actual} onChange={(e) => setActual(e.target.value)} />
        {diff !== null && (
          <span
            data-testid="variance"
            className={`w-fit rounded-md px-2 py-1 ${diff === 0 ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}
          >
            {bi(t.varianceVsModel(formatVariance(diff)))}
          </span>
        )}
        {fieldError(!!errors.actual, bi(t.actualInvalid))}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {bi(t.notes)} *
        <textarea
          className="min-h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
          value={notes}
          maxLength={MAX_NOTES}
          onChange={(e) => setNotes(e.target.value)}
        />
        {fieldError(touched && !!errors.notes, bi(t.notesRequired))}
      </label>

      {error && (
        <p role="alert" data-testid="submit-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {asking ? (
        <div role="alertdialog" aria-label={bi(t.cancelAsk)} className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-red-900">{bi(t.cancelAsk)}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="bg-red-700 text-white hover:bg-red-800" onClick={onCancel}>
              {bi(t.cancelYes)}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAsking(false)}>
              {bi(t.cancelNo)}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={busy} onClick={onBack}>
            {bi(t.stepDetect)}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setAsking(true)}>
            {bi(t.cancel)}
          </Button>
          <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={!valid || busy}>
            {bi(busy ? t.submitting : t.submit)}
          </Button>
        </div>
      )}
    </form>
  )
}
