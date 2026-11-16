import { useEffect, useState, type ReactNode } from 'react'

// Login illustration: the letters "RAI" melt into the five team members (flat shapes with eyes,
// after Tang's reference picture). Heights follow the real ones: Tang 185, Opor 183, Hymm 180,
// Game 165, Guy 165 cm (exaggerated so the difference reads). Motion lives in index.css (.crew).
//
// mood: idle = look at the viewer; watch = lean toward the form, eyes follow the text;
// away = password shown, they turn away; wrong = lean back + head shake (replays on every `wrongKey`).
export type CrewMood = 'idle' | 'watch' | 'away' | 'wrong'

const GROUND = 400
const INK = '#0a1a4a'
const heightOf = (cm: number) => (cm - 110) * 4 // 185 cm -> 300 px

type Member = {
  name: string
  x: number
  w: number
  cm: number
  r: number // top corner radius (w/2 = round top)
  fill: string
  ey: number // eye line from the top of the body
  light?: boolean // light body: eye whites get an outline
  back?: ReactNode // drawn behind the body (long hair)
  hair?: ReactNode // drawn over the body, does not turn with the face
  face?: ReactNode // extras that turn with the face (glasses)
  smile?: ReactNode // replaces the default smile (braces)
}

const members: Member[] = [
  {
    name: 'Tang',
    x: 186,
    w: 118,
    cm: 185,
    r: 16,
    fill: '#c4875a', // tan skin
    ey: 74,
    // comma hair: short cap + fringe that curls in like a comma
    hair: (
      <g fill={INK}>
        <path d="M0 34V16Q0 0 16 0H102Q118 0 118 16V34Q96 24 72 26Q40 30 0 34Z" />
        <path d="M78 22C52 18 32 32 38 48C42 58 56 58 58 49C52 51 46 46 50 40C55 33 66 31 82 31Z" />
      </g>
    ),
    // pink-gold glasses
    face: (
      <g fill="none" stroke="#f6b3c6" strokeWidth="4.5">
        <circle cx="-13" cy="0" r="14" />
        <circle cx="17" cy="0" r="14" />
        <path d="M1 -2Q2 -6 3 -2" strokeLinecap="round" />
      </g>
    ),
  },
  {
    name: 'Opor',
    x: 296,
    w: 104,
    cm: 183,
    r: 52,
    fill: '#ffffff',
    ey: 76,
    light: true,
    // dry, spiky hair: gold on top, black roots showing through
    hair: (
      <g>
        <path d="M2 50L-6 22L12 30L14 4L30 20L42 -8L54 16L70 -6L76 18L96 4L94 30L110 24L102 50Q52 36 2 50Z" fill={INK} />
        <path d="M8 40L4 24L16 30L20 10L32 24L44 0L54 22L68 2L74 24L92 12L90 32L100 30L96 42Q52 30 8 40Z" fill="#e7b53e" />
        <path d="M30 24L36 38M58 20L60 34M80 22L78 36" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
  },
  {
    name: 'Hymm',
    x: 30,
    w: 172,
    cm: 180,
    r: 76,
    fill: '#fd91cc',
    ey: 82,
    // short tuft
    hair: (
      <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
        <path d="M80 2Q74 -14 64 -16" />
        <path d="M88 0Q90 -18 98 -22" />
      </g>
    ),
    face: (
      <g fill="#f0569f" opacity=".7">
        <ellipse cx="-28" cy="22" rx="10" ry="6" />
        <ellipse cx="40" cy="22" rx="10" ry="6" />
      </g>
    ),
  },
  {
    name: 'Game',
    x: 394,
    w: 96,
    cm: 165,
    r: 48,
    fill: '#ffd166',
    ey: 72,
    // long hair behind the body + fringe + pink bow
    back: <path d="M-10 160V48A58 58 0 0 1 106 48V160Q96 150 88 160V60H8V160Q0 150 -10 160Z" fill="#3a2418" />,
    hair: (
      <g>
        <path d="M2 46A46 46 0 0 1 94 46Q70 30 50 40Q30 30 2 46Z" fill="#3a2418" />
        <g fill="#fd91cc" stroke={INK} strokeWidth="2">
          <path d="M70 8L86 -2L84 18Z" />
          <path d="M70 8L56 -4L58 16Z" />
          <circle cx="70" cy="8" r="4" />
        </g>
      </g>
    ),
    // lashes
    face: (
      <g stroke={INK} strokeWidth="2.5" strokeLinecap="round">
        <path d="M-22 -8L-27 -12M24 -8L29 -12" />
      </g>
    ),
  },
  {
    name: 'Guy',
    x: 482,
    w: 96,
    cm: 165,
    r: 12,
    fill: '#f9dcc8', // fair skin
    ey: 70,
    light: true,
    // two-block: long top block over short, darker sides
    hair: (
      <g>
        <path d="M0 22H14V46H0Z M82 22H96V46H82Z" fill="#6b6f80" />
        <path d="M-4 30V8Q-4 -8 12 -8H86Q100 -8 100 8V26Q74 18 40 30Q14 36 -4 30Z" fill={INK} />
      </g>
    ),
    // braces: open grin, teeth with a wire and brackets
    smile: (
      <g>
        <path d="M-12 22H16Q14 36 2 36Q-10 36 -12 22Z" fill={INK} />
        <path d="M-10 23H14V28H-10Z" fill="#fff" />
        <path d="M-10 25.5H14" stroke="#9aa3b8" strokeWidth="1.6" />
        <g fill="#9aa3b8">
          <rect x="-7" y="24" width="3" height="3" />
          <rect x="0.5" y="24" width="3" height="3" />
          <rect x="8" y="24" width="3" height="3" />
        </g>
      </g>
    ),
  },
]

// Back row first, front row last.
const drawOrder = ['Tang', 'Opor', 'Hymm', 'Game', 'Guy'].map((n) => members.find((m) => m.name === n)!)

function bodyPath(w: number, h: number, r: number) {
  return `M0 ${h}V${r}Q0 0 ${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h}Z`
}

function Character({ m, i }: { m: Member; i: number }) {
  const h = heightOf(m.cm)
  const fx = m.w * 0.54 // faces sit a bit right, toward the form
  const sclera = m.light ? { stroke: INK, strokeWidth: 2 } : {}
  return (
    <g transform={`translate(${m.x} ${GROUND - h})`}>
      <g className="crew-lean" style={{ ['--i' as string]: i }}>
        <g className="crew-grow" style={{ ['--i' as string]: i }}>
          {m.back}
          <path d={bodyPath(m.w, h, m.r)} fill={m.fill} />
          {m.hair}
          <g className="crew-face" style={{ ['--turn' as string]: `${-m.w * 0.2}px` }}>
            <g transform={`translate(${fx} ${m.ey})`}>
              <g className="crew-brows" stroke={INK} strokeWidth="3.5" strokeLinecap="round">
                <path className="crew-brow-l" d="M-20 -24H-7" />
                <path className="crew-brow-r" d="M10 -24H23" />
              </g>
              <g className="crew-eyes" style={{ ['--i' as string]: i }}>
                <circle cx="-13" cy="0" r="9" fill="#fff" {...sclera} />
                <circle cx="17" cy="0" r="9" fill="#fff" {...sclera} />
                <g className="crew-pupils" fill={INK}>
                  <circle cx="-13" cy="0" r="4.6" />
                  <circle cx="17" cy="0" r="4.6" />
                </g>
              </g>
              {m.face}
              <g className="crew-mouth" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round">
                <g className="m-smile">{m.smile ?? <path d="M-6 24Q2 32 10 24" />}</g>
                <ellipse className="m-o" cx="2" cy="28" rx="4.5" ry="5.5" fill={INK} stroke="none" />
                <path className="m-flat" d="M-4 28H8" />
                <path className="m-frown" d="M-6 32Q2 24 10 32" />
              </g>
            </g>
          </g>
        </g>
      </g>
      <text x={m.w / 2} y={h + 26} textAnchor="middle" className="crew-name">
        {m.name}
      </text>
    </g>
  )
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

type Phase = 'letters' | 'morph' | 'ready'

export default function LoginCrew({
  mood,
  look = 0,
  lookRow = 0,
  wrongKey = 0,
}: {
  mood: CrewMood
  look?: number // 0..1, how far along the field the text is (eyes follow it)
  lookRow?: 0 | 1 // 0 = Operator ID field, 1 = password field (looks a bit lower)
  wrongKey?: number // bump to replay the wrong-password shake
}) {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'ready' : 'letters'))

  useEffect(() => {
    if (phase === 'ready') return
    const a = setTimeout(() => setPhase('morph'), 1100)
    const b = setTimeout(() => setPhase('ready'), 2100)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [phase])

  // Pupils: centre when idle; toward the form (right, a bit down) when watching, sliding with the text.
  const px = mood === 'watch' ? 1.5 + look * 3 : 0
  const py = mood === 'watch' ? 1.5 + lookRow * 1.8 : 0

  return (
    <svg
      viewBox="-24 -16 668 466"
      aria-hidden="true"
      data-testid="crew"
      data-mood={mood}
      data-phase={phase}
      className="crew block h-auto w-full"
      style={{ ['--px' as string]: `${px}px`, ['--py' as string]: `${py}px` }}
    >
      <g className="crew-letters" fill="#fff">
        {['R', 'A', 'I'].map((l, i) => (
          <text key={l} x={150 + i * 160} y={GROUND} textAnchor="middle" className="crew-letter" style={{ ['--i' as string]: i }}>
            {l}
          </text>
        ))}
      </g>
      <path d={`M14 ${GROUND + 1.5}H606`} stroke="#fff" strokeOpacity=".28" strokeWidth="3" strokeLinecap="round" />
      {/* key: a new wrong attempt remounts the crew so the shake replays */}
      <g key={mood === 'wrong' ? `w${wrongKey}` : 'crew'}>
        {drawOrder.map((m, i) => (
          <Character key={m.name} m={m} i={i} />
        ))}
      </g>
    </svg>
  )
}
