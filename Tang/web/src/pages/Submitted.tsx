import { Button } from '@/components/ui/button'
import StepCard from '@/components/StepCard'
import { pct } from '@/components/ResultCard'
import type { RecordRow } from '@/lib/api'
import { formatVariance } from '@/lib/confirm'
import { bi, t } from '@/lib/i18n'

type Props = {
  record: RecordRow
  meanConfidence: number | null
  onNew: () => void
  onDashboard: () => void
}

// Short, readable form of the batch uuid.
export const shortId = (batchId: string) => batchId.slice(0, 8).toUpperCase()

export default function Submitted({ record, meanConfidence, onNew, onDashboard }: Props) {
  const rows: [string, string, string][] = [
    ['do', bi(t.doNumber), record.doNumber ?? '-'],
    ['actual', bi(t.actualAmount), String(record.actualAmount ?? '-')],
    ['detected', bi(t.detected), String(record.modelTotal)],
    ['confidence', bi(t.confidence), pct(meanConfidence)],
    ['variance', bi(t.varianceLabel), record.variance === null ? '-' : formatVariance(record.variance)],
    ['notes', bi(t.notes), record.notes ?? '-'],
    ['id', bi(t.recordId), shortId(record.batchId)],
    ['time', bi(t.submittedAt), new Date(record.confirmedAt ?? record.createdAt).toLocaleString()],
  ]
  return (
    <StepCard step={3} title={t.submittedTitle.th} subtitle={t.submittedTitle.en}>
      <dl data-testid="summary" className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        {rows.map(([key, label, value]) => (
          <div key={key} className="contents">
            <dt className="text-sm text-gray-600">{label}</dt>
            <dd data-testid={`summary-${key}`} className="font-medium break-words text-gray-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={onNew}>
          {bi(t.startNew)}
        </Button>
        <Button variant="outline" onClick={onDashboard}>
          {bi(t.viewDashboard)}
        </Button>
      </div>
    </StepCard>
  )
}
