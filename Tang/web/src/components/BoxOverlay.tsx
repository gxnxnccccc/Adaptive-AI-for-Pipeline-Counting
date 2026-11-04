import { useState } from 'react'
import { toRect, type DetectedPipe } from '@/lib/detection'

type Props = { src: string; alt?: string; pipes: DetectedPipe[] }

// Photo with an SVG on top. viewBox = natural pixel size, so boxes in image pixels line up at any display size.
export default function BoxOverlay({ src, alt = '', pipes }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-gray-100">
      <img
        src={src}
        alt={alt}
        className="block h-auto w-full"
        onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      />
      {size && (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="pointer-events-none absolute inset-0 size-full"
        >
          {pipes.map((p, i) => {
            const { x, y, w, h } = toRect(p.box)
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                strokeWidth={Math.max(2, size.w / 400)}
                className={p.lowConfidence ? 'box-low stroke-orange-500' : 'box-ok stroke-green-600'}
              />
            )
          })}
        </svg>
      )}
    </div>
  )
}
