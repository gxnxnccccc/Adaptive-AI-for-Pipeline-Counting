import { useState } from 'react'
import { useNavigate } from 'react-router'
import ConfirmForm, { type ConfirmSubmit } from '@/components/ConfirmForm'
import ResultCard, { pct, type Photo } from '@/components/ResultCard'
import Stepper from '@/components/Stepper'
import StepCard from '@/components/StepCard'
import { Button } from '@/components/ui/button'
import { confirmBatch, type RecordRow } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { summarize } from '@/lib/detection'
import { bi, t } from '@/lib/i18n'
import Capture, { type CaptureDone } from '@/pages/Capture'
import Submitted from '@/pages/Submitted'

// Holds the flow state: step, photos + results, batch id.
export default function NewDetection() {
  const { operator } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [photos, setPhotos] = useState<Photo[]>([])
  // The saved draft batch. Confirm sends it with the ids of the photos still kept.
  const [batchId, setBatchId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<{ record: RecordRow; meanConfidence: number | null } | null>(null)
  const navigate = useNavigate()

  function onDone(done: CaptureDone) {
    setPhotos(done.photos)
    setBatchId(done.batchId)
    setStep(2)
  }

  const totals = summarize(photos.map((p) => p.result))

  function reset() {
    setPhotos([])
    setBatchId(null)
    setSubmitted(null)
    setStep(1)
  }

  async function submit(v: ConfirmSubmit) {
    if (!batchId) throw new Error('No saved batch, please upload again')
    const record = await confirmBatch(batchId, { ...v, imageIds: photos.map((p) => p.result.imageId) })
    setSubmitted({ record, meanConfidence: totals.meanConfidence })
  }

  if (submitted) {
    return (
      <Submitted
        record={submitted.record}
        meanConfidence={submitted.meanConfidence}
        onNew={reset}
        onDashboard={() => navigate('/dashboard')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Stepper current={step} />

      {step === 1 && <Capture operatorId={operator ?? undefined} onDone={onDone} />}

      {step === 2 && (
        <StepCard step={2} title={t.stepDetect.th} subtitle={t.stepDetect.en}>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-blue-50 p-3">
            <div>
              <div className="text-sm text-gray-700">{bi(t.totalCount)}</div>
              <div data-testid="total-count" className="text-3xl font-bold text-blue-700">
                {totals.count}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-700">{bi(t.meanConf)}</div>
              <div data-testid="mean-confidence" className="text-3xl font-bold text-blue-700">
                {pct(totals.meanConfidence)}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">{bi(t.lowConfLegend)}</p>
          {photos.length === 0 && <p className="text-gray-700">{bi(t.noPhotosLeft)}</p>}
          <ul className="flex flex-col gap-3">
            {photos.map((p) => (
              <ResultCard key={p.id} photo={p} onRemove={(id) => setPhotos((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setStep(1)}>
              {bi(t.backToUpload)}
            </Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={photos.length === 0} onClick={() => setStep(3)}>
              {bi(t.continueConfirm)}
            </Button>
          </div>
        </StepCard>
      )}

      {step === 3 && (
        <StepCard step={3} title={t.stepConfirm.th} subtitle={t.stepConfirm.en}>
          <ConfirmForm modelTotal={totals.count} onSubmit={submit} onCancel={reset} onBack={() => setStep(2)} />
        </StepCard>
      )}
    </div>
  )
}
