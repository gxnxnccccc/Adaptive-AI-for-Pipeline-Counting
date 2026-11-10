// Login illustration: a drawn stack of pipe ends with detection boxes popping in + a scan line.
// Port of makeStack()/sceneSVG() from docs/design/preview/login.html (seed 5, 7 rows x 11 cols). Decorative only.
// The hex stops paint the "photo" (steel, rust, wall); UI colours come from the theme tokens.
import { LOW_CONFIDENCE as LOW } from '@/lib/detection'

// mulberry32, same as the preview so the picture matches it
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pipe = { cx: number; cy: number; r: number; conf: number; rust: boolean }

function makeStack(seed: number, rows: number, cols: number, r: number, base: number, low: number) {
  const R = rng(seed)
  const d = r * 2.04
  const pipes: Pipe[] = []
  for (let i = 0; i < rows; i++) {
    const n = cols - (i % 2)
    const x0 = 400 - ((n - 1) * d) / 2
    const y = base - r - i * d * 0.866
    for (let j = 0; j < n; j++) {
      let conf = 0.78 + R() * 0.21
      if (R() < low) conf = 0.3 + R() * 0.19
      const cx = x0 + j * d + (R() - 0.5) * 3
      const cy = y + (R() - 0.5) * 3
      const pr = r * (0.93 + R() * 0.1)
      pipes.push({ cx, cy, r: pr, conf, rust: R() < 0.18 })
    }
  }
  return pipes
}

const BASE = 590
const PIPES = makeStack(5, 7, 11, 26, BASE, 0.06)

const CSS = `
.pa-box{opacity:0;animation:pa-pop .35s ease-out forwards;transform-box:fill-box;transform-origin:center}
@keyframes pa-pop{from{opacity:0;transform:scale(1.25)}to{opacity:1;transform:none}}
.pa-scan{position:absolute;left:0;right:0;top:0;height:24%;pointer-events:none;
  background:linear-gradient(to bottom,transparent,rgb(37 99 235 / .28) 85%,rgb(96 165 250 / .95) 100%);
  animation:pa-scan 1.6s cubic-bezier(.45,0,.55,1) infinite}
@keyframes pa-scan{from{transform:translateY(-100%)}to{transform:translateY(340%)}}
@media (prefers-reduced-motion:reduce){
  .pa-box{animation:none;opacity:1}
  .pa-scan{animation:none;top:auto;bottom:0;height:3px;background:var(--color-accent);opacity:.9}
}`

export default function PipeArt() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <style>{CSS}</style>
      <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="block size-full">
        <defs>
          <radialGradient id="pa-steel" cx="45%" cy="40%" r="60%">
            <stop offset="0" stopColor="#d5dbe3" />
            <stop offset=".55" stopColor="#8e98a6" />
            <stop offset=".85" stopColor="#4b5563" />
            <stop offset="1" stopColor="#20252c" />
          </radialGradient>
          <radialGradient id="pa-rust" cx="45%" cy="40%" r="60%">
            <stop offset="0" stopColor="#c9b29a" />
            <stop offset=".55" stopColor="#8a6f58" />
            <stop offset=".85" stopColor="#53412f" />
            <stop offset="1" stopColor="#241b14" />
          </radialGradient>
          <radialGradient id="pa-hole" cx="55%" cy="58%" r="60%">
            <stop offset="0" stopColor="#010203" />
            <stop offset=".7" stopColor="#090c10" />
            <stop offset="1" stopColor="#2d333c" />
          </radialGradient>
          <linearGradient id="pa-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a323d" />
            <stop offset=".7" stopColor="#171c23" />
            <stop offset="1" stopColor="#101318" />
          </linearGradient>
          <linearGradient id="pa-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b2f35" />
            <stop offset="1" stopColor="#0c0e11" />
          </linearGradient>
          <pattern id="pa-rib" width="28" height="600" patternUnits="userSpaceOnUse">
            <rect width="3" height="600" fill="#fff" opacity=".035" />
            <rect x="14" width="1" height="600" fill="#000" opacity=".3" />
          </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#pa-wall)" />
        <rect width="800" height="600" fill="url(#pa-rib)" />
        <rect y={BASE - 30} width="800" height={630 - BASE} fill="url(#pa-floor)" />
        <ellipse cx="400" cy={BASE} rx="300" ry="14" fill="#000" opacity=".55" />
        {PIPES.map((p, i) => (
          <circle key={`b${i}`} cx={p.cx} cy={p.cy} r={p.r * 1.2} fill="#05070a" />
        ))}
        {PIPES.map((p, i) => (
          <g key={`e${i}`}>
            <circle cx={p.cx} cy={p.cy} r={p.r} fill={`url(#pa-${p.rust ? 'rust' : 'steel'})`} />
            <circle cx={p.cx + p.r * 0.04} cy={p.cy + p.r * 0.05} r={p.r * 0.64} fill="url(#pa-hole)" />
          </g>
        ))}
        {PIPES.map((p, i) => {
          const r = p.r * 1.06
          return (
            <rect
              key={`x${i}`}
              data-testid="art-box"
              className={p.conf < LOW ? 'pa-box fill-transparent stroke-warn' : 'pa-box fill-transparent stroke-accent'}
              strokeDasharray={p.conf < LOW ? '6 4' : undefined}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              x={p.cx - r}
              y={p.cy - r}
              width={2 * r}
              height={2 * r}
              rx={4}
              style={{ animationDelay: `${400 + i * 28}ms` }}
            />
          )
        })}
      </svg>
      <div className="pa-scan" />
    </div>
  )
}
