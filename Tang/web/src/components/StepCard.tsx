import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  step: number
  title: string
  subtitle?: string
  active?: boolean
  children: ReactNode
}

// Step number badge + title. Inactive badge uses gray-500 (gray-300 in Figma fails contrast).
export default function StepCard({ step, title, subtitle, active = true, children }: Props) {
  return (
    <Card className="gap-5 rounded-2xl border-0 py-5 shadow-md sm:py-6">
      <CardHeader className="flex-row items-center gap-3 sm:px-6">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white',
            active ? 'bg-blue-600' : 'bg-gray-500',
          )}
        >
          {step}
        </span>
        <h2 className="flex flex-col">
          <span className="sr-only">Step {step}: </span>
          <span className="text-xl font-bold text-gray-800">{title}</span>
          {subtitle && <span className="text-sm font-normal text-gray-600">{subtitle}</span>}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:px-6">{children}</CardContent>
    </Card>
  )
}
