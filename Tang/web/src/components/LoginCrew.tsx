import { useEffect, useState, type ReactNode } from 'react'

// Login illustration: the letters "RAI" melt into the five team members, drawn after Tang's character
// sheets (2026-11-24): Tang = black panther, Opor = wolf, Hymm = gorilla, Game = fox, Guy = raccoon.
// Chibi proportions (big head), heights still follow the real ones (Tang 185 … Game/Guy 165 cm).
// No brand logos on the props (plain laptop, plain red key). Motion lives in index.css (.crew).
//
// mood: idle = look at the viewer; watch = lean toward the form, eyes follow the text;
// away = password shown, they turn away; wrong = lean back + head shake (replays on every `wrongKey`);
// happy = correct password: they jump once, one after another, before the app opens.
export type CrewMood = 'idle' | 'watch' | 'away' | 'wrong' | 'happy'

const GROUND = 400
const INK = '#0a1a4a'
const heightOf = (cm: number) => (cm - 110) * 3.6 // 185 cm -> 270 px

// Every part is drawn in the character's own box: x 0..w, y 0 (top of the head) .. h (ground).
type Draw = (w: number, h: number, head: number) => ReactNode
type Member = {
  name: string
  x: number
  w: number
  cm: number
  head: number // head height (chibi: ~45% of the body)
  ey: number // eye line from the top
  line?: string // brows + mouth colour (light on dark fur)
  sclera?: string // eye white colour
  ring?: boolean // outline the eye whites (light faces)
  back?: Draw // behind everything (tail)
  body: Draw // outfit, arms, legs, shoes
  skull: Draw // head shape + ears
  under?: ReactNode // turns with the face, under the eyes (muzzle, mask, nose); face coords
  over?: ReactNode // turns with the face, over the eyes (glasses, lashes); face coords
  top?: Draw // on the head, does not turn (headphones, beanie, goggles)
  front?: Draw // held in front (laptop, racket, key)
}

// Shared body: hoodie / jacket torso + sleeves, trousers, shoes. Colours per member.
function outfit(w: number, h: number, head: number, c: { top: string; trim: string; pants: string; shoe: string; sole?: string }) {
  const x0 = w * 0.16
  const x1 = w * 0.84
  const waist = h - 46
  return (
    <g>
      {/* legs */}
      <rect x={w * 0.24} y={waist - 4} width={w * 0.22} height={h - waist - 6} rx="6" fill={c.pants} />
      <rect x={w * 0.54} y={waist - 4} width={w * 0.22} height={h - waist - 6} rx="6" fill={c.pants} />
      {/* shoes */}
      <ellipse cx={w * 0.34} cy={h - 6} rx={w * 0.16} ry="8" fill={c.shoe} />
      <ellipse cx={w * 0.66} cy={h - 6} rx={w * 0.16} ry="8" fill={c.shoe} />
      <rect x={w * 0.18} y={h - 4} width={w * 0.32} height="4" rx="2" fill={c.sole ?? '#ffffff'} />
      <rect x={w * 0.5} y={h - 4} width={w * 0.32} height="4" rx="2" fill={c.sole ?? '#ffffff'} />
      {/* sleeves */}
      <rect x={x0 - w * 0.1} y={head - 4} width={w * 0.2} height={waist - head - 2} rx={w * 0.1} fill={c.top} />
      <rect x={x1 - w * 0.1} y={head - 4} width={w * 0.2} height={waist - head - 2} rx={w * 0.1} fill={c.top} />
      {/* torso */}
      <path d={`M${x0} ${waist + 6}V${head + 4}Q${x0} ${head - 10} ${x0 + 14} ${head - 10}H${x1 - 14}Q${x1} ${head - 10} ${x1} ${head + 4}V${waist + 6}Z`} fill={c.top} />
      {/* zip / placket + hem */}
      <path d={`M${w / 2} ${head - 6}V${waist + 4}`} stroke={c.trim} strokeWidth="3" />
      <rect x={x0} y={waist} width={x1 - x0} height="7" fill={c.trim} />
    </g>
  )
}

const ear = (x: number, y: number, s: number, tilt: number, outer: string, inner: string) => (
  <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
    <path d={`M${-s} 0L0 ${-s * 1.5}L${s} 0Z`} fill={outer} />
    <path d={`M${-s * 0.5} -2L0 ${-s * 1.05}L${s * 0.5} -2Z`} fill={inner} />
  </g>
)

const members: Member[] = [
  {
    // 01 The Alpha: black panther, purple / black / cyan techwear, futuristic headphones
    name: 'Tang',
    x: 186,
    w: 118,
    cm: 185,
    head: 112,
    ey: 60,
    line: '#e4dcff',
    sclera: '#ffd23f',
    back: (w, h) => <path d={`M${w * 0.82} ${h - 40}C${w * 1.15} ${h - 50} ${w * 1.12} ${h - 110} ${w * 0.98} ${h - 120}`} fill="none" stroke="#1b1a24" strokeWidth="11" strokeLinecap="round" />,
    body: (w, h, head) => (
      <g>
        {outfit(w, h, head, { top: '#23212e', trim: '#2fd6e8', pants: '#1b1a24', shoe: '#7b4ae2' })}
        {/* purple techwear panels */}
        <path d={`M${w * 0.16} ${head + 20}L${w * 0.42} ${head + 44}V${head + 62}L${w * 0.16} ${head + 40}Z`} fill="#7b4ae2" />
        <path d={`M${w * 0.84} ${head + 20}L${w * 0.58} ${head + 44}V${head + 62}L${w * 0.84} ${head + 40}Z`} fill="#7b4ae2" />
      </g>
    ),
    skull: (w, _h, head) => (
      <g>
        {ear(w * 0.2, 22, 18, -18, '#1b1a24', '#7b4ae2')}
        {ear(w * 0.8, 22, 18, 18, '#1b1a24', '#7b4ae2')}
        {/* lighter rim so black fur still reads on the deep-blue panel */}
        <rect x="0" y="6" width={w} height={head - 6} rx={w * 0.42} fill="#1b1a24" stroke="#4b4566" strokeWidth="3" />
      </g>
    ),
    under: (
      <g>
        <ellipse cx="2" cy="22" rx="20" ry="13" fill="#34313f" />
        <path d="M-3 13H7L2 18Z" fill="#7b4ae2" />
        {/* plaster on the cheek */}
        <g transform="translate(-30 18) rotate(-20)">
          <rect x="-9" y="-4" width="18" height="8" rx="3" fill="#f6c9a8" />
          <path d="M-2 -4V4M2 -4V4" stroke="#d99b74" strokeWidth="1.2" />
        </g>
      </g>
    ),
    top: (w) => (
      <g>
        <path d={`M${w * 0.06} 46Q${w * 0.5} -26 ${w * 0.94} 46`} fill="none" stroke="#e9e6f5" strokeWidth="7" strokeLinecap="round" />
        <rect x={-10} y="40" width="22" height="34" rx="9" fill="#7b4ae2" />
        <rect x={w - 12} y="40" width="22" height="34" rx="9" fill="#7b4ae2" />
        <circle cx="1" cy="57" r="7" fill="none" stroke="#2fd6e8" strokeWidth="3" />
        <circle cx={w - 1} cy="57" r="7" fill="none" stroke="#2fd6e8" strokeWidth="3" />
      </g>
    ),
  },
  {
    // 02 The Silent Genius: wolf, silver / ice blue / navy, hoodie, goggles up, laptop
    name: 'Opor',
    x: 296,
    w: 104,
    cm: 183,
    head: 106,
    ey: 60,
    ring: true,
    body: (w, h, head) => (
      <g>
        {outfit(w, h, head, { top: '#f4f6fb', trim: '#7cc3ea', pants: '#1d2b5a', shoe: '#ffffff', sole: '#7cc3ea' })}
        <rect x={w * 0.16} y={head + 10} width={w * 0.68} height="6" fill="#7cc3ea" />
        <rect x={w * 0.16} y={head + 20} width={w * 0.68} height="4" fill="#1d2b5a" />
      </g>
    ),
    skull: (w, _h, head) => (
      <g>
        {ear(w * 0.2, 20, 17, -14, '#9aa5b6', '#e3e8f1')}
        {ear(w * 0.8, 20, 17, 14, '#9aa5b6', '#e3e8f1')}
        <rect x="0" y="6" width={w} height={head - 6} rx={w * 0.4} fill="#b9c2d0" />
        {/* cheek fluff */}
        <path d={`M2 ${head * 0.62}L-8 ${head * 0.74}L6 ${head * 0.78}Z M${w - 2} ${head * 0.62}L${w + 8} ${head * 0.74}L${w - 6} ${head * 0.78}Z`} fill="#b9c2d0" />
      </g>
    ),
    under: (
      <g>
        <ellipse cx="2" cy="24" rx="22" ry="15" fill="#eef2f8" />
        <ellipse cx="2" cy="13" rx="6" ry="4.5" fill={INK} />
      </g>
    ),
    top: (w) => (
      // ice-blue goggles pushed up on the forehead
      <g>
        <rect x="2" y="24" width={w - 4} height="7" rx="3" fill="#1d2b5a" />
        <rect x={w * 0.2} y="16" width={w * 0.3} height="18" rx="8" fill="#a8dcf5" stroke="#1d2b5a" strokeWidth="3" />
        <rect x={w * 0.52} y="16" width={w * 0.3} height="18" rx="8" fill="#a8dcf5" stroke="#1d2b5a" strokeWidth="3" />
        <path d={`M${w * 0.26} 21L${w * 0.32} 27`} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    ),
    front: (w, h) => (
      // plain silver laptop held at the chest
      <g transform={`translate(${w * 0.18} ${h - 104}) rotate(-6)`}>
        <rect x="0" y="0" width={w * 0.66} height="44" rx="5" fill="#c9ced8" />
        <rect x="-4" y="40" width={w * 0.66 + 8} height="7" rx="3" fill="#aab1bf" />
        <circle cx={w * 0.33} cy="20" r="5" fill="#a8dcf5" />
      </g>
    ),
  },
  {
    // 03 The Playboy: gorilla, red / gold / charcoal luxury streetwear, gold shades, chain, red key
    name: 'Hymm',
    x: 30,
    w: 172,
    cm: 180,
    head: 120,
    ey: 66,
    body: (w, h, head) => (
      <g>
        {outfit(w, h, head, { top: '#d7262e', trim: '#ffffff', pants: '#2c2c34', shoe: '#d7262e' })}
        {/* white tee + gold chain */}
        <path d={`M${w * 0.38} ${head - 8}H${w * 0.62}L${w * 0.58} ${head + 60}H${w * 0.42}Z`} fill="#ffffff" />
        <path d={`M${w * 0.36} ${head - 4}Q${w * 0.5} ${head + 46} ${w * 0.64} ${head - 4}`} fill="none" stroke="#f1b72c" strokeWidth="5" strokeDasharray="6 3" />
        <circle cx={w * 0.5} cy={head + 38} r="7" fill="#f1b72c" />
      </g>
    ),
    skull: (w, _h, head) => (
      <g>
        <circle cx={w * 0.08} cy={head * 0.55} r="14" fill="#2c2c34" />
        <circle cx={w * 0.92} cy={head * 0.55} r="14" fill="#2c2c34" />
        <rect x={w * 0.04} y="0" width={w * 0.92} height={head} rx={w * 0.4} fill="#2c2c34" />
        {/* face skin */}
        <path d={`M${w * 0.2} ${head * 0.36}Q${w * 0.54} ${head * 0.18} ${w * 0.86} ${head * 0.36}Q${w * 0.92} ${head} ${w * 0.54} ${head - 4}Q${w * 0.16} ${head} ${w * 0.2} ${head * 0.36}Z`} fill="#8a7a72" />
      </g>
    ),
    under: (
      <g>
        <ellipse cx="2" cy="26" rx="34" ry="17" fill="#a3938a" />
        <ellipse cx="-4" cy="14" rx="4" ry="3" fill={INK} />
        <ellipse cx="9" cy="14" rx="4" ry="3" fill={INK} />
      </g>
    ),
    top: (w) => (
      // gold sunglasses on top of the head
      <g>
        <path d={`M${w * 0.2} 30H${w * 0.86}`} stroke="#f1b72c" strokeWidth="4" />
        <path d={`M${w * 0.26} 22H${w * 0.48}L${w * 0.45} 40H${w * 0.3}Z M${w * 0.58} 22H${w * 0.8}L${w * 0.77} 40H${w * 0.62}Z`} fill="#f1b72c" stroke="#a8740c" strokeWidth="2.5" />
      </g>
    ),
    front: (w, h) => (
      // plain red car key in the left hand
      <g transform={`translate(${w * 0.02} ${h - 92})`}>
        <circle cx="10" cy="10" r="11" fill="#8a7a72" />
        <rect x="2" y="-18" width="16" height="26" rx="5" fill="#b3131b" stroke="#f1b72c" strokeWidth="2" />
        <circle cx="10" cy="-10" r="3" fill="#f1b72c" />
      </g>
    ),
  },
  {
    // 04 The Forgetful Spark: fox girl, pink / orange / cream, sporty, goggles, badminton racket
    name: 'Game',
    x: 394,
    w: 96,
    cm: 165,
    head: 100,
    ey: 58,
    back: (w, h) => (
      <g>
        <path d={`M${w * 0.2} ${h - 50}C${-w * 0.35} ${h - 40} ${-w * 0.3} ${h - 110} ${w * 0.05} ${h - 100}`} fill="none" stroke="#f39a3d" strokeWidth="20" strokeLinecap="round" />
        <circle cx={w * 0.05} cy={h - 101} r="10" fill="#fff3df" />
      </g>
    ),
    body: (w, h, head) => (
      <g>
        {outfit(w, h, head, { top: '#fdfdff', trim: '#ff6fa8', pants: '#7a4fd0', shoe: '#ff6fa8' })}
        <path d={`M${w * 0.2} ${h - 52}H${w * 0.8}L${w * 0.86} ${h - 30}H${w * 0.14}Z`} fill="#7a4fd0" />
      </g>
    ),
    skull: (w, _h, head) => (
      <g>
        {ear(w * 0.18, 22, 17, -20, '#f39a3d', '#fff3df')}
        {ear(w * 0.82, 22, 17, 20, '#f39a3d', '#fff3df')}
        <rect x="0" y="6" width={w} height={head - 6} rx={w * 0.44} fill="#f39a3d" />
        {/* pink fringe */}
        <path d={`M4 ${head * 0.42}Q${w * 0.1} 4 ${w * 0.5} 6Q${w * 0.9} 4 ${w - 4} ${head * 0.42}Q${w * 0.74} ${head * 0.2} ${w * 0.56} ${head * 0.32}Q${w * 0.4} ${head * 0.16} ${w * 0.24} ${head * 0.34}Q${w * 0.12} ${head * 0.26} 4 ${head * 0.42}Z`} fill="#ff7eb0" />
      </g>
    ),
    under: (
      <g>
        <ellipse cx="2" cy="24" rx="20" ry="13" fill="#fff3df" />
        <ellipse cx="2" cy="15" rx="4.5" ry="3.5" fill={INK} />
        <ellipse cx="-26" cy="16" rx="7" ry="4" fill="#ff6fa8" opacity=".6" />
        <ellipse cx="30" cy="16" rx="7" ry="4" fill="#ff6fa8" opacity=".6" />
      </g>
    ),
    over: (
      <g stroke={INK} strokeWidth="2.5" strokeLinecap="round">
        <path d="M-22 -8L-27 -12M24 -8L29 -12" />
      </g>
    ),
    top: (w) => (
      // pink goggles on the head + a yellow hair clip
      <g>
        <rect x={w * 0.14} y="8" width={w * 0.72} height="14" rx="7" fill="#ffd1e4" stroke="#ff6fa8" strokeWidth="3" />
        <path d={`M${w * 0.72} 30l8 0m-4 -4l0 8`} stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
      </g>
    ),
    front: (w, h) => (
      // badminton racket
      <g transform={`translate(${w * 0.9} ${h - 70}) rotate(24)`}>
        <rect x="-3" y="-6" width="6" height="40" rx="3" fill="#ff6fa8" />
        <ellipse cx="0" cy="-30" rx="15" ry="20" fill="#ffffff" fillOpacity=".6" stroke="#ff6fa8" strokeWidth="4" />
        <path d="M-8 -46V-14M0 -50V-10M8 -46V-14M-14 -36H14M-14 -28H14M-12 -20H12" stroke="#ffb0cf" strokeWidth="1.2" />
      </g>
    ),
  },
  {
    // 05 The Good Vibes: raccoon, mint / cream / brown, beanie, round glasses, sweater, headphones
    name: 'Guy',
    x: 482,
    w: 96,
    cm: 165,
    head: 100,
    ey: 60,
    ring: true,
    back: (w, h) => (
      <g strokeLinecap="round" fill="none">
        <path d={`M${w * 0.8} ${h - 36}C${w * 1.3} ${h - 40} ${w * 1.3} ${h - 96} ${w * 1.05} ${h - 104}`} stroke="#8d8d96" strokeWidth="20" />
        <path d={`M${w * 1.18} ${h - 56}l12 -2M${w * 1.2} ${h - 78}l12 4`} stroke="#3d3d46" strokeWidth="7" />
      </g>
    ),
    body: (w, h, head) => (
      <g>
        {outfit(w, h, head, { top: '#f3e7c6', trim: '#d8c89c', pants: '#2f7d4f', shoe: '#f3e7c6', sole: '#2f7d4f' })}
        {/* headphones around the neck */}
        <path d={`M${w * 0.22} ${head - 4}Q${w * 0.5} ${head + 26} ${w * 0.78} ${head - 4}`} fill="none" stroke="#3d3d46" strokeWidth="6" />
        <rect x={w * 0.14} y={head - 6} width="16" height="20" rx="6" fill="#2f7d4f" />
        <rect x={w * 0.86 - 16} y={head - 6} width="16" height="20" rx="6" fill="#2f7d4f" />
      </g>
    ),
    skull: (w, _h, head) => (
      <g>
        {ear(w * 0.2, 26, 14, -16, '#8d8d96', '#f2f2f2')}
        {ear(w * 0.8, 26, 14, 16, '#8d8d96', '#f2f2f2')}
        <rect x="0" y="8" width={w} height={head - 8} rx={w * 0.42} fill="#9a9aa3" />
      </g>
    ),
    under: (
      <g>
        {/* dark mask around the eyes, white muzzle */}
        <path d="M-34 -4Q-24 -16 -4 -8Q2 -6 8 -8Q28 -16 38 -4Q30 14 10 8Q2 6 -6 8Q-26 14 -34 -4Z" fill="#3d3d46" />
        <ellipse cx="2" cy="24" rx="20" ry="13" fill="#f2f2f2" />
        <ellipse cx="2" cy="14" rx="5" ry="3.5" fill={INK} />
      </g>
    ),
    over: (
      // round glasses
      <g fill="none" stroke="#e8e8ee" strokeWidth="3">
        <circle cx="-13" cy="0" r="13" />
        <circle cx="17" cy="0" r="13" />
        <path d="M0 0H4" />
      </g>
    ),
    top: (w) => (
      // green beanie with a lighter band and a little patch
      <g>
        <path d={`M2 34Q2 -6 ${w / 2} -6Q${w - 2} -6 ${w - 2} 34Z`} fill="#2f7d4f" />
        <rect x="-2" y="26" width={w + 4} height="14" rx="6" fill="#4caf74" />
        <rect x={w * 0.42} y="8" width="14" height="10" rx="2" fill="#c8e6c9" />
      </g>
    ),
  },
]

// Back row first, front row last.
const drawOrder = ['Tang', 'Opor', 'Hymm', 'Game', 'Guy'].map((n) => members.find((m) => m.name === n)!)

function Character({ m, i }: { m: Member; i: number }) {
  const h = heightOf(m.cm)
  const fx = m.w * 0.54 // faces sit a bit right, toward the form
  const line = m.line ?? INK
  const eye = { fill: m.sclera ?? '#fff', ...(m.ring ? { stroke: INK, strokeWidth: 2 } : {}) }
  return (
    <g transform={`translate(${m.x} ${GROUND - h})`} data-member={m.name}>
      <g className="crew-lean" style={{ ['--i' as string]: i }}>
        <g className="crew-grow" style={{ ['--i' as string]: i }}>
          {m.back?.(m.w, h, m.head)}
          {m.body(m.w, h, m.head)}
          {m.skull(m.w, h, m.head)}
          <g className="crew-face" style={{ ['--turn' as string]: `${-m.w * 0.2}px` }}>
            <g transform={`translate(${fx} ${m.ey})`}>
              {m.under}
              <g className="crew-brows" stroke={line} strokeWidth="3.5" strokeLinecap="round">
                <path className="crew-brow-l" d="M-20 -22H-7" />
                <path className="crew-brow-r" d="M10 -22H23" />
              </g>
              <g className="crew-eyes" style={{ ['--i' as string]: i }}>
                <circle cx="-13" cy="0" r="9" {...eye} />
                <circle cx="17" cy="0" r="9" {...eye} />
                <g className="crew-pupils" fill={INK}>
                  <circle cx="-13" cy="0" r="4.6" />
                  <circle cx="17" cy="0" r="4.6" />
                </g>
              </g>
              {m.over}
              <g className="crew-mouth" fill="none" stroke={line} strokeWidth="3.5" strokeLinecap="round">
                <path className="m-smile" d="M-6 24Q2 32 10 24" />
                <ellipse className="m-o" cx="2" cy="28" rx="4.5" ry="5.5" fill={line} stroke="none" />
                <path className="m-flat" d="M-4 28H8" />
                <path className="m-frown" d="M-6 32Q2 24 10 32" />
              </g>
            </g>
          </g>
          {m.top?.(m.w, h, m.head)}
          {m.front?.(m.w, h, m.head)}
        </g>
      </g>
    </g>
  )
}

export const prefersReducedMotion = () =>
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
      // Top = tallest member's ears minus the 38 px jump; bottom = just under the shoes (no name labels any more).
      viewBox="-24 40 668 372"
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
