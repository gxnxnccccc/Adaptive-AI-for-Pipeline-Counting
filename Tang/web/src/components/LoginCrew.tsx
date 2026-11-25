import { useEffect, useState, type ReactNode } from 'react'

// Login illustration: the letters "RAI" melt into the five team members, drawn from Tang's character
// prompts + sheets (docs/design/character-prompts.md, 2026-11-25) in a designer-toy style: chibi heads,
// thick outlines, glossy highlights. Tang = black panther (the leader, centre front), Opor = wolf,
// Hymm = gorilla, Game = fox, Guy = raccoon (sits, his hero pose). Heights follow the real ones
// (Tang 185 … Game/Guy 165 cm). No brand logos on the props (plain laptops, plain red key).
// Motion lives in index.css (.crew).
//
// mood: idle = look at the viewer; watch = lean toward the form, eyes follow the text;
// away = password shown, they look away; wrong = lean back + head shake (replays on every `wrongKey`);
// happy = correct password: they jump once, one after another, before the app opens.
// Every member shows one of the 4 expressions from their prompt per mood (`moods` below, data-expr).
export type CrewMood = 'idle' | 'watch' | 'away' | 'wrong' | 'happy'

const GROUND = 400
const INK = '#0a1a4a'
const OL = '#16112b' // the toy outline
const SW = 3
const heightOf = (cm: number) => (cm - 110) * 3.6 // 185 cm -> 270 px

type Eyes = 'open' | 'lid' | 'wide' | 'sparkle' | 'up' | 'happy' | 'closed' | 'wink' | 'heart' | 'shades'
type Mouth = 'smile' | 'small' | 'smirk' | 'grin' | 'open' | 'o' | 'flat' | 'frown' | 'wavy' | 'hmm'
type Mark = '!' | '?' | 'zz' | 'sparkle' | 'sweat' | 'dots' | 'note'
type Brows = [number, number, number, number] // left brow: rotate (deg), y shift; right brow: rotate, y shift
type Face = { name: string; eyes: Eyes; mouth: Mouth; brows: Brows; lid?: number; mark?: Mark }
const face = (name: string, eyes: Eyes, mouth: Mouth, brows: Brows = [0, 0, 0, 0], more: Partial<Face> = {}): Face => ({
  name,
  eyes,
  mouth,
  brows,
  ...more,
})

// Every part is drawn in the character's own box: x 0..w, y 0 (top of the head) .. h (ground).
type Draw = (w: number, h: number, head: number) => ReactNode
type Member = {
  name: string
  x: number
  w: number
  cm: number
  sit?: boolean // sits cross-legged (Guy)
  head: number // where the body starts (chibi: about half the height)
  fx: number // face centre x
  fy: number // eye line y
  er: number // eye radius
  eg: number // half the gap between the eyes
  my: number // mouth, below the eye line
  mw?: number // mouth width (Hymm's grin is wider)
  fur: string // eyelids take the fur colour around the eyes
  line?: string // brows + mouth (light on dark fur)
  sclera?: string
  pupil?: string
  slit?: boolean // cat pupils
  ring?: boolean // outline the eye whites
  brow?: [number, number] // brow length, stroke width
  lean?: number // how far they lean in (introverts less)
  hop?: number // how high they jump
  mark: [number, number] // where ! ? zz pop up
  moods: Record<CrewMood, Face>
  back?: Draw // behind the body (tail, backpack)
  body: Draw // outfit, arms, legs, shoes
  skull: Draw // head shape, ears, hair
  under?: ReactNode // turns with the face, under the eyes (muzzle, mask, nose); face coords
  over?: (f: Face) => ReactNode // turns with the face, over the eyes (glasses, shades, lashes); face coords
  top?: Draw // on the head, does not turn (headphones, beanie, goggles)
  front?: Draw // held in front (laptop, racket, key)
}

// Outlined tube for arms, tails and straps.
const tube = (d: string, color: string, width: number) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={OL} strokeWidth={width + SW * 2} />
    <path d={d} stroke={color} strokeWidth={width} />
  </g>
)
// Glossy toy highlight.
const gloss = (cx: number, cy: number, rx: number, ry: number, rot = -25, o = 0.35) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} fill="#fff" opacity={o} stroke="none" />
)
const ear = (x: number, y: number, s: number, tilt: number, outer: string, inner: string) => (
  <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
    <path d={`M${-s} 6Q${-s * 0.7} ${-s * 0.8} 0 ${-s * 1.6}Q${s * 0.7} ${-s * 0.8} ${s} 6Z`} fill={outer} />
    <path d={`M${-s * 0.5} 2Q${-s * 0.35} ${-s * 0.5} 0 ${-s * 1.1}Q${s * 0.35} ${-s * 0.5} ${s * 0.5} 2Z`} fill={inner} stroke="none" />
  </g>
)
// Front-view sneaker: a rounded toe on a sole.
const shoe = (cx: number, h: number, sw: number, upper: string, sole: string, accent?: string) => (
  <g>
    <path d={`M${cx - sw / 2} ${h - 3}Q${cx - sw / 2} ${h - 18} ${cx} ${h - 18}Q${cx + sw / 2} ${h - 18} ${cx + sw / 2} ${h - 3}Z`} fill={upper} />
    <rect x={cx - sw / 2 - 1} y={h - 7} width={sw + 2} height="7" rx="3.5" fill={sole} />
    {accent && <path d={`M${cx - sw * 0.22} ${h - 12}H${cx + sw * 0.22}`} stroke={accent} strokeWidth="3" strokeLinecap="round" />}
    {gloss(cx - sw * 0.16, h - 14, sw * 0.13, 2.5)}
  </g>
)
const star = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy - s}Q${cx + s * 0.16} ${cy - s * 0.16} ${cx + s} ${cy}Q${cx + s * 0.16} ${cy + s * 0.16} ${cx} ${cy + s}` +
  `Q${cx - s * 0.16} ${cy + s * 0.16} ${cx - s} ${cy}Q${cx - s * 0.16} ${cy - s * 0.16} ${cx} ${cy - s}Z`
const heart = (x: number, s: number) =>
  `M${x} ${s * 0.6}C${x - s * 1.2} ${-s * 0.15} ${x - s * 0.62} ${-s * 1.1} ${x} ${-s * 0.42}C${x + s * 0.62} ${-s * 1.1} ${x + s * 1.2} ${-s * 0.15} ${x} ${s * 0.6}Z`

const members: Member[] = [
  {
    // 01 TANG, The Alpha: black panther, techwear jacket (purple + cyan), arms crossed, oversized glowing
    // headphones, long tail. Confident, not a villain.
    name: 'Tang',
    x: 282,
    w: 124,
    cm: 185,
    head: 128,
    fx: 64,
    fy: 72,
    er: 10.5,
    eg: 17,
    my: 25,
    fur: '#1d1b27',
    line: '#e6defe',
    sclera: '#ffd23f',
    slit: true,
    brow: [13, 4.5],
    lean: 1,
    hop: 1.1,
    mark: [126, 10],
    moods: {
      idle: face('confident', 'lid', 'smirk', [0, 0, -12, -3], { lid: 0.3 }),
      watch: face('competitive', 'lid', 'grin', [14, 2, -14, 2], { lid: 0.2 }),
      away: face('confident', 'closed', 'smirk', [0, -2, -8, -3]),
      wrong: face('angry', 'open', 'frown', [22, 3, -22, 3], { mark: '!' }),
      happy: face('excited', 'happy', 'open', [0, -6, 0, -6], { mark: 'sparkle' }),
    },
    back: (_w, h) => (
      // long tail: out from the hip into the gap on his right, curling up
      <g className="crew-tail" style={{ transformOrigin: '0% 85%' }}>
        {tube(`M90 ${h - 66}C122 ${h - 58} 150 ${h - 70} 148 ${h - 102}C147 ${h - 120} 130 ${h - 124} 126 ${h - 112}`, '#25222f', 12)}
        <path d={`M100 ${h - 64}C124 ${h - 60} 142 ${h - 72} 141 ${h - 98}`} fill="none" stroke="#8a5cf0" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
      </g>
    ),
    body: (w, h, head) => {
      const waist = h - 62
      return (
        <g>
          {/* techwear cargo pants with purple straps */}
          <rect x={w * 0.25} y={waist - 6} width={w * 0.23} height={h - waist - 6} rx="9" fill="#1d1b27" />
          <rect x={w * 0.52} y={waist - 6} width={w * 0.23} height={h - waist - 6} rx="9" fill="#1d1b27" />
          <rect x={w * 0.25} y={waist + 14} width="13" height="15" rx="3" fill="#2d2a3c" strokeWidth="2" />
          <rect x={w * 0.75 - 13} y={waist + 14} width="13" height="15" rx="3" fill="#2d2a3c" strokeWidth="2" />
          <path d={`M${w * 0.25} ${waist + 36}h${w * 0.23}M${w * 0.52} ${waist + 36}h${w * 0.23}`} stroke="#8a5cf0" strokeWidth="5" />
          {shoe(w * 0.36, h, 38, '#f5f3ff', '#7b4ae2', '#2fd6e8')}
          {shoe(w * 0.64, h, 38, '#f5f3ff', '#7b4ae2', '#2fd6e8')}
          {/* black jacket, purple shoulder panels, cyan zip, purple hem */}
          <path d={`M${w * 0.14} ${waist + 8}V${head + 12}Q${w * 0.14} ${head - 12} ${w * 0.34} ${head - 12}H${w * 0.66}Q${w * 0.86} ${head - 12} ${w * 0.86} ${head + 12}V${waist + 8}Z`} fill="#2a2738" />
          <path d={`M${w * 0.14} ${head + 12}Q${w * 0.14} ${head - 12} ${w * 0.34} ${head - 12}L${w * 0.4} ${head + 16}L${w * 0.14} ${head + 30}Z`} fill="#7b4ae2" />
          <path d={`M${w * 0.86} ${head + 12}Q${w * 0.86} ${head - 12} ${w * 0.66} ${head - 12}L${w * 0.6} ${head + 16}L${w * 0.86} ${head + 30}Z`} fill="#7b4ae2" />
          <path d={`M${w / 2} ${head - 8}V${waist + 4}`} stroke="#2fd6e8" strokeWidth="3" />
          <rect x={w * 0.14} y={waist} width={w * 0.72} height="9" fill="#7b4ae2" />
          {/* arms crossed: upper arms, back forearm, front forearm, one paw on the biceps */}
          {tube(`M${w * 0.17} ${head + 4}Q${w * 0.02} ${head + 26} ${w * 0.12} ${head + 46}`, '#2a2738', 22)}
          {tube(`M${w * 0.83} ${head + 4}Q${w * 0.98} ${head + 26} ${w * 0.88} ${head + 46}`, '#2a2738', 22)}
          {tube(`M${w * 0.12} ${head + 46}Q${w * 0.45} ${head + 54} ${w * 0.8} ${head + 38}`, '#2a2738', 21)}
          {tube(`M${w * 0.88} ${head + 48}Q${w * 0.55} ${head + 58} ${w * 0.24} ${head + 42}`, '#34304a', 21)}
          <path d={`M${w * 0.3} ${head + 34}L${w * 0.3} ${head + 52}`} stroke="#8a5cf0" strokeWidth="6" />
          <ellipse cx={w * 0.2} cy={head + 38} rx="9" ry="8" fill="#1d1b27" />
        </g>
      )
    },
    skull: (w) => (
      <g>
        {ear(w * 0.18, 28, 20, -16, '#1d1b27', '#8a5cf0')}
        {ear(w * 0.82, 28, 20, 16, '#1d1b27', '#8a5cf0')}
        {/* round head with little cheek tufts (lilac rim so black fur reads on the blue panel) */}
        <path
          d={`M4 70Q4 10 ${w / 2} 10Q${w - 4} 10 ${w - 4} 70Q${w - 4} 100 ${w - 16} 114L${w - 6} 122Q${w * 0.72} 132 ${w / 2} 130Q${w * 0.28} 132 6 122L16 114Q4 100 4 70Z`}
          fill="#1d1b27"
          stroke="#4b4566"
        />
        {/* sleek fur: purple highlight + toy gloss */}
        <path d="M16 56Q20 28 46 18" stroke="#8a5cf0" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".8" />
        {gloss(38, 30, 12, 5, -30, 0.2)}
      </g>
    ),
    under: (
      <g>
        <ellipse cx="0" cy="23" rx="19" ry="13" fill="#3a3650" />
        <path d="M-5.5 12H5.5L0 18Z" fill="#b48cff" strokeWidth="2" />
        <g fill="#8d84b0" stroke="none">
          <circle cx="-10" cy="25" r="1.5" />
          <circle cx="-14" cy="21" r="1.5" />
          <circle cx="10" cy="25" r="1.5" />
          <circle cx="14" cy="21" r="1.5" />
        </g>
        {/* plaster on the cheek (from his sheet) */}
        <g transform="translate(-34 17) rotate(-20)">
          <rect x="-9" y="-4.5" width="18" height="9" rx="3.5" fill="#f6c9a8" strokeWidth="2" />
          <path d="M-2 -4V4M2 -4V4" stroke="#d99b74" strokeWidth="1.2" />
        </g>
      </g>
    ),
    top: (w) => (
      // signature: oversized headphones, purple + glowing cyan
      <g>
        {tube(`M3 64Q${w / 2} -38 ${w - 3} 64`, '#eeeaf8', 9)}
        <path d={`M16 40Q${w / 2} 2 ${w - 16} 40`} fill="none" stroke="#8a5cf0" strokeWidth="3" strokeDasharray="12 7" strokeLinecap="round" />
        {[2, w - 2].map((cx) => (
          <g key={cx} transform={`translate(${cx} 84)`}>
            <circle className="crew-glow" r="30" fill="url(#crew-glow-cyan)" stroke="none" />
            <rect x="-15" y="-26" width="30" height="52" rx="14" fill="#f4f2fb" />
            <circle r="12" fill="#7b4ae2" strokeWidth="2.5" />
            <circle r="6.5" fill="#101426" stroke="#3ef0ff" strokeWidth="3" />
            {gloss(-5, -16, 5, 3, -30, 0.7)}
          </g>
        ))}
      </g>
    ),
  },
  {
    // 02 OPOR, The Silent Genius: wolf, oversized white hoodie, cargo pants, backpack, visor goggles,
    // sleepy eyes, futuristic laptop with a soft ice-blue glow. Quiet, not sad.
    name: 'Opor',
    x: 164,
    w: 106,
    cm: 183,
    head: 124,
    fx: 55,
    fy: 74,
    er: 9.5,
    eg: 16,
    my: 23,
    fur: '#b3bccb',
    ring: true,
    lean: 0.5,
    hop: 0.7,
    mark: [104, 10],
    moods: {
      idle: face('tired', 'lid', 'small', [0, 1, 0, 1], { lid: 0.46 }),
      watch: face('focused', 'lid', 'flat', [10, 3, -10, 3], { lid: 0.3 }),
      away: face('tired', 'closed', 'small', [0, 1, 0, 1], { mark: 'zz' }),
      wrong: face('surprised', 'wide', 'o', [0, -7, 0, -7], { mark: 'sweat' }),
      happy: face('happy', 'happy', 'smile', [0, -5, 0, -5]),
    },
    back: (_w, h, head) => (
      <g>
        {/* small utility backpack peeking out */}
        <rect x="-8" y={head + 6} width="30" height="56" rx="9" fill="#24335f" />
        <rect x="-4" y={head + 32} width="15" height="18" rx="4" fill="#33467f" strokeWidth="2" />
        {/* fluffy wolf tail, white tip */}
        <g className="crew-tail" style={{ transformOrigin: '100% 80%' }}>
          <path d={`M28 ${h - 56}C8 ${h - 40} -24 ${h - 54} -26 ${h - 84}C-27 ${h - 102} -18 ${h - 116} -10 ${h - 120}C-14 ${h - 100} -2 ${h - 84} 26 ${h - 82}Z`} fill="#a3adbf" />
          <path d={`M-10 ${h - 120}C-18 ${h - 116} -27 ${h - 102} -26 ${h - 84}C-21 ${h - 92} -15 ${h - 100} -10 ${h - 120}Z`} fill="#f4f6fb" />
        </g>
      </g>
    ),
    body: (w, h, head) => {
      const waist = h - 60
      return (
        <g>
          {/* navy cargo pants */}
          <rect x={w * 0.24} y={waist - 6} width={w * 0.24} height={h - waist - 4} rx="8" fill="#1d2b5a" />
          <rect x={w * 0.52} y={waist - 6} width={w * 0.24} height={h - waist - 4} rx="8" fill="#1d2b5a" />
          <rect x={w * 0.2} y={waist + 16} width="13" height="16" rx="3" fill="#2a3b72" strokeWidth="2" />
          <rect x={w * 0.8 - 13} y={waist + 16} width="13" height="16" rx="3" fill="#2a3b72" strokeWidth="2" />
          {shoe(w * 0.36, h, 34, '#ffffff', '#7cc3ea', '#1d2b5a')}
          {shoe(w * 0.64, h, 34, '#ffffff', '#7cc3ea', '#1d2b5a')}
          {/* oversized white hoodie + ribbed hem */}
          <path d={`M${w * 0.1} ${waist + 8}V${head + 12}Q${w * 0.1} ${head - 12} ${w * 0.32} ${head - 12}H${w * 0.68}Q${w * 0.9} ${head - 12} ${w * 0.9} ${head + 12}V${waist + 8}Z`} fill="#f4f6fb" />
          <rect x={w * 0.1} y={waist} width={w * 0.8} height="9" rx="3" fill="#dfe6f2" strokeWidth="2" />
          {/* ice-blue hoodie drawstrings */}
          <path d={`M${w * 0.43} ${head + 4}V${head + 26}M${w * 0.57} ${head + 4}V${head + 22}`} stroke="#7cc3ea" strokeWidth="3" strokeLinecap="round" />
          {/* backpack straps */}
          {tube(`M${w * 0.24} ${head - 6}Q${w * 0.21} ${head + 22} ${w * 0.25} ${head + 44}`, '#24335f', 7)}
          {tube(`M${w * 0.76} ${head - 6}Q${w * 0.79} ${head + 22} ${w * 0.75} ${head + 44}`, '#24335f', 7)}
          {/* sleeves down to the laptop */}
          {tube(`M${w * 0.14} ${head + 2}Q${w * 0.0} ${head + 28} ${w * 0.16} ${head + 50}`, '#f4f6fb', 20)}
          {tube(`M${w * 0.86} ${head + 2}Q${w * 1.0} ${head + 28} ${w * 0.84} ${head + 50}`, '#f4f6fb', 20)}
        </g>
      )
    },
    skull: (w) => (
      <g>
        {ear(w * 0.17, 26, 19, -12, '#8f99ab', '#e3e8f1')}
        {ear(w * 0.83, 26, 19, 12, '#8f99ab', '#e3e8f1')}
        {/* messy hair tuft */}
        <path d={`M${w * 0.3} 22L${w * 0.36} -2L${w * 0.47} 14L${w * 0.55} -6L${w * 0.62} 14L${w * 0.74} 0L${w * 0.72} 24Z`} fill="#b3bccb" />
        {/* fluffy head with cheek fluff */}
        <path
          d={`M4 72Q4 12 ${w / 2} 12Q${w - 4} 12 ${w - 4} 72Q${w - 4} 94 ${w - 12} 106L${w + 4} 112L${w - 14} 120Q${w / 2} 134 14 120L-4 112L12 106Q4 94 4 72Z`}
          fill="#b3bccb"
        />
        {gloss(w * 0.3, 30, 12, 5, -30, 0.4)}
      </g>
    ),
    under: (
      <g>
        <ellipse cx="0" cy="23" rx="21" ry="14" fill="#eef2f8" />
        <ellipse cx="0" cy="12" rx="6.5" ry="4.5" fill={INK} strokeWidth="2" />
      </g>
    ),
    top: (w) => (
      // ice-blue visor goggles pushed up on the forehead
      <g>
        <rect x="3" y="30" width={w - 6} height="7" rx="3.5" fill="#1d2b5a" />
        <rect x={w * 0.2} y="15" width={w * 0.6} height="23" rx="11" fill="#a8dcf5" stroke="#1d2b5a" strokeWidth="3.5" />
        <path d={`M${w * 0.28} 21L${w * 0.42} 21`} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx={w * 0.7} cy="27" r="2.5" fill="#fff" stroke="none" />
      </g>
    ),
    front: (w, _h, head) => (
      // futuristic laptop: brushed lid toward us, ice-blue light bar, screen glow spilling over the top
      <g transform={`translate(${w * 0.5} ${head + 48}) rotate(-4)`}>
        <ellipse className="crew-glow" cx="0" cy="-24" rx="42" ry="13" fill="url(#crew-glow-ice)" stroke="none" />
        <rect x="-34" y="-23" width="68" height="44" rx="6" fill="url(#crew-alu)" />
        <rect x="-38" y="19" width="76" height="7" rx="3.5" fill="#9aa3b3" />
        <rect className="crew-glow" x="-10" y="-4" width="20" height="5" rx="2.5" fill="#bdeeff" stroke="#5ec8f2" strokeWidth="1.5" />
        {gloss(-18, -13, 11, 3, -20, 0.6)}
        <ellipse cx="-36" cy="4" rx="8" ry="10" fill="#a3adbf" />
        <ellipse cx="36" cy="4" rx="8" ry="10" fill="#a3adbf" />
      </g>
    ),
  },
  {
    // 03 HYMM, The Playboy: gorilla, red varsity jacket open over a white tee, gold chain, gold shades,
    // wide cheeky grin, one hand in the pocket, the other showing off a plain red car key.
    name: 'Hymm',
    x: 8,
    w: 150,
    cm: 180,
    head: 126,
    fx: 80,
    fy: 74,
    er: 9.5,
    eg: 17,
    my: 30,
    mw: 1.5,
    fur: '#8a7a72',
    line: '#241e22',
    brow: [17, 6],
    lean: 0.8,
    hop: 0.9,
    mark: [140, 14],
    moods: {
      idle: face('smug', 'lid', 'grin', [-10, -4, 6, 0], { lid: 0.3 }),
      watch: face('cool', 'shades', 'smirk', [0, -3, 0, -3]),
      away: face('cool', 'shades', 'smirk', [0, -3, 0, -3]),
      wrong: face('laughing', 'happy', 'open', [0, -6, 0, -6]),
      happy: face('lovestruck', 'heart', 'grin', [-8, -6, 8, -6]),
    },
    body: (w, h, head) => {
      const waist = h - 58
      return (
        <g>
          {/* relaxed black pants */}
          <path d={`M${w * 0.25} ${waist - 6}H${w * 0.48}L${w * 0.49} ${h - 10}H${w * 0.22}Z`} fill="#26262d" />
          <path d={`M${w * 0.52} ${waist - 6}H${w * 0.75}L${w * 0.78} ${h - 10}H${w * 0.51}Z`} fill="#26262d" />
          {shoe(w * 0.35, h, 42, '#d7262e', '#ffffff', '#f1b72c')}
          {shoe(w * 0.65, h, 42, '#d7262e', '#ffffff', '#f1b72c')}
          {/* white tee */}
          <rect x={w * 0.34} y={head - 10} width={w * 0.32} height={waist - head + 16} fill="#ffffff" />
          {/* red varsity jacket, worn open */}
          <path d={`M${w * 0.12} ${waist + 8}V${head + 14}Q${w * 0.12} ${head - 12} ${w * 0.3} ${head - 12}H${w * 0.4}L${w * 0.42} ${waist + 8}Z`} fill="#d7262e" />
          <path d={`M${w * 0.88} ${waist + 8}V${head + 14}Q${w * 0.88} ${head - 12} ${w * 0.7} ${head - 12}H${w * 0.6}L${w * 0.58} ${waist + 8}Z`} fill="#d7262e" />
          {/* striped rib hem, snap buttons, gold chenille H */}
          <rect x={w * 0.12} y={waist} width={w * 0.3} height="10" fill="#ffffff" strokeWidth="2" />
          <rect x={w * 0.58} y={waist} width={w * 0.3} height="10" fill="#ffffff" strokeWidth="2" />
          <path d={`M${w * 0.12} ${waist + 5}H${w * 0.42}M${w * 0.58} ${waist + 5}H${w * 0.88}`} stroke="#d7262e" strokeWidth="2.5" />
          {[16, 34, 52].map((dy) => (
            <circle key={dy} cx={w * 0.395} cy={head + dy} r="2.6" fill="#ffffff" strokeWidth="1.5" />
          ))}
          <g stroke={OL} strokeWidth="8" strokeLinecap="round">
            <path d={`M${w * 0.2} ${head + 16}V${head + 36}M${w * 0.3} ${head + 16}V${head + 36}M${w * 0.2} ${head + 26}H${w * 0.3}`} />
          </g>
          <path d={`M${w * 0.2} ${head + 16}V${head + 36}M${w * 0.3} ${head + 16}V${head + 36}M${w * 0.2} ${head + 26}H${w * 0.3}`} stroke="#f1b72c" strokeWidth="4" strokeLinecap="round" />
          {/* thick gold chain + pendant */}
          <path d={`M${w * 0.37} ${head - 4}Q${w * 0.5} ${head + 44} ${w * 0.63} ${head - 4}`} fill="none" stroke={OL} strokeWidth="8" />
          <path d={`M${w * 0.37} ${head - 4}Q${w * 0.5} ${head + 44} ${w * 0.63} ${head - 4}`} fill="none" stroke="#f1b72c" strokeWidth="4.5" strokeDasharray="5 2.5" />
          <circle cx={w * 0.5} cy={head + 22} r="7.5" fill="#f1b72c" />
          {gloss(w * 0.48, head + 19, 3, 2, -30, 0.8)}
          {/* powerful arms: right hand in the pocket, left arm raised (key in front layer) */}
          {tube(`M${w * 0.86} ${head + 2}Q${w * 1.04} ${head + 40} ${w * 0.84} ${waist - 6}`, '#d7262e', 26)}
          {tube(`M${w * 0.14} ${head + 2}Q${-w * 0.08} ${head + 40} ${w * 0.0} ${head - 2}`, '#d7262e', 26)}
          <path d={`M${-w * 0.035} ${head + 6}l${w * 0.08} ${-2}`} stroke="#ffffff" strokeWidth="7" />
        </g>
      )
    },
    skull: (w) => (
      <g>
        <circle cx="8" cy="80" r="15" fill="#2c2c34" />
        <circle cx="8" cy="80" r="7" fill="#8a7a72" stroke="none" />
        <circle cx={w - 8} cy="80" r="15" fill="#2c2c34" />
        <circle cx={w - 8} cy="80" r="7" fill="#8a7a72" stroke="none" />
        <path d={`M${w * 0.34} 14L${w * 0.4} -4L${w * 0.48} 10L${w * 0.56} -6L${w * 0.62} 14Z`} fill="#2c2c34" />
        <path d={`M6 76Q6 8 ${w / 2} 8Q${w - 6} 8 ${w - 6} 76Q${w - 6} 132 ${w / 2} 134Q6 132 6 76Z`} fill="#2c2c34" />
        {/* face skin + heavy brow ridge */}
        <path
          d={`M${w * 0.2} 64Q${w * 0.2} 42 ${w * 0.36} 42Q${w * 0.53} 48 ${w * 0.7} 42Q${w * 0.88} 42 ${w * 0.87} 64Q${w * 0.95} 92 ${w * 0.85} 114Q${w * 0.53} 136 ${w * 0.22} 114Q${w * 0.12} 92 ${w * 0.2} 64Z`}
          fill="#8a7a72"
        />
        <path d={`M${w * 0.22} 58Q${w * 0.37} 46 ${w * 0.53} 54Q${w * 0.69} 46 ${w * 0.86} 58`} stroke="#1f1f26" strokeWidth="7" fill="none" strokeLinecap="round" />
        {gloss(w * 0.27, 28, 14, 6, -25, 0.22)}
      </g>
    ),
    under: (
      <g>
        <ellipse cx="0" cy="29" rx="35" ry="21" fill="#a3938a" />
        <ellipse cx="-7" cy="15" rx="4" ry="3" fill="#2a1f1f" stroke="none" />
        <ellipse cx="7" cy="15" rx="4" ry="3" fill="#2a1f1f" stroke="none" />
      </g>
    ),
    over: (f) => (
      // gold shades: on the head, slide down over the eyes when he plays it cool
      <g className="crew-shades" style={{ transform: f.eyes === 'shades' ? 'none' : 'translateY(-38px)' }}>
        <path d="M-31 -8H31" stroke={OL} strokeWidth="7" strokeLinecap="round" />
        <path d="M-31 -8H31" stroke="#f1b72c" strokeWidth="3.5" strokeLinecap="round" />
        <path
          d="M-30 -9H-4L-6 6Q-7 11 -12 11H-23Q-29 11 -29 6Z M4 -9H30L29 6Q29 11 23 11H12Q7 11 6 6Z"
          fill="url(#crew-gold-lens)"
          stroke={OL}
          strokeWidth="2.5"
        />
        <path d="M-25 -4L-17 -4M9 -4L17 -4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".85" />
      </g>
    ),
    front: (_w, _h, head) => (
      // plain red car key held up (no maker logo), jiggling
      <g transform={`translate(0 ${head - 8})`}>
        <g className="crew-key">
          <circle cx="0" cy="-38" r="6" fill="none" stroke={OL} strokeWidth="6" />
          <circle cx="0" cy="-38" r="6" fill="none" stroke="#d7dbe3" strokeWidth="3" />
          <path d="M-12 -26Q-12 -33 -5 -33H5Q12 -33 12 -26V-4Q12 7 0 9Q-12 7 -12 -4Z" fill="#c8141c" strokeWidth="2.5" />
          <path d="M-8.5 -25Q-8.5 -29.5 -4 -29.5H4Q8.5 -29.5 8.5 -25V-5Q8.5 3.5 0 5.5Q-8.5 3.5 -8.5 -5Z" fill="none" stroke="#f1b72c" strokeWidth="2" />
          <path d="M2 -24L-4 -13H1L-2 -4L6 -16H1L4 -24Z" fill="#f1b72c" stroke="none" />
          {gloss(-5, -22, 2.5, 6, 0, 0.55)}
        </g>
        <ellipse cx="0" cy="4" rx="13" ry="11" fill="#3a3a42" />
        <path d="M-8 1H8M-8 6H8" stroke="#1f1f26" strokeWidth="1.5" />
      </g>
    ),
  },
  {
    // 04 GAME, The Forgetful Spark: fox girl, pink + orange hair, goggles, X clip, white sporty jacket,
    // lavender skirt, striped socks, badminton racket, fluffy tail, and a shuttlecock she forgot in her hair.
    name: 'Game',
    x: 438,
    w: 100,
    cm: 165,
    head: 106,
    fx: 52,
    fy: 70,
    er: 11.5,
    eg: 18,
    my: 21,
    fur: '#f6a04a',
    pupil: '#5e1a4c',
    ring: true,
    brow: [11, 3],
    lean: 1.4,
    hop: 1.35,
    mark: [104, 18],
    moods: {
      idle: face('excited', 'sparkle', 'open', [0, -4, 0, -4]),
      watch: face('surprised', 'wide', 'o', [0, -7, 0, -7]),
      away: face('distracted', 'up', 'smile', [0, -3, 0, -3], { mark: 'note' }),
      wrong: face('confused', 'open', 'wavy', [-14, -6, 10, 1], { mark: '?' }),
      happy: face('excited', 'wink', 'open', [0, -7, 0, -7], { mark: 'sparkle' }),
    },
    back: (_w, h) => (
      // big fluffy tail with a cream tip, wagging in the gap on her right
      <g className="crew-tail crew-wag" style={{ transformOrigin: '0% 80%' }}>
        <path d={`M66 ${h - 44}C92 ${h - 30} 126 ${h - 52} 124 ${h - 92}C123 ${h - 112} 112 ${h - 124} 102 ${h - 126}C108 ${h - 104} 100 ${h - 78} 70 ${h - 72}Z`} fill="#f6a04a" />
        <path d={`M102 ${h - 126}C112 ${h - 124} 123 ${h - 112} 124 ${h - 92}C116 ${h - 98} 108 ${h - 106} 102 ${h - 126}Z`} fill="#fff3df" />
      </g>
    ),
    body: (w, h, head) => {
      const waist = h - 50
      return (
        <g>
          {/* striped knee socks + chunky pink sneakers */}
          <rect x={w * 0.3} y={waist + 8} width={w * 0.16} height={h - waist - 16} rx="6" fill="#ffffff" />
          <rect x={w * 0.54} y={waist + 8} width={w * 0.16} height={h - waist - 16} rx="6" fill="#ffffff" />
          <path d={`M${w * 0.3} ${h - 32}h${w * 0.16}M${w * 0.3} ${h - 25}h${w * 0.16}M${w * 0.54} ${h - 32}h${w * 0.16}M${w * 0.54} ${h - 25}h${w * 0.16}`} stroke="#ff6f91" strokeWidth="3" />
          {shoe(w * 0.38, h, 30, '#ff8fb8', '#ffffff', '#ffffff')}
          {shoe(w * 0.62, h, 30, '#ff8fb8', '#ffffff', '#ffffff')}
          {/* lavender pleated skirt */}
          <path d={`M${w * 0.22} ${waist - 6}H${w * 0.78}L${w * 0.88} ${waist + 18}H${w * 0.12}Z`} fill="#a98bf0" />
          <path d={`M${w * 0.36} ${waist - 4}L${w * 0.32} ${waist + 17}M${w * 0.5} ${waist - 4}V${waist + 17}M${w * 0.64} ${waist - 4}L${w * 0.68} ${waist + 17}`} stroke="#7d5ed0" strokeWidth="2" />
          {/* white sporty jacket over a pink top */}
          <path d={`M${w * 0.14} ${waist}V${head + 10}Q${w * 0.14} ${head - 12} ${w * 0.34} ${head - 12}H${w * 0.66}Q${w * 0.86} ${head - 12} ${w * 0.86} ${head + 10}V${waist}Z`} fill="#ffffff" />
          <path d={`M${w * 0.38} ${head - 10}L${w * 0.5} ${head + 14}L${w * 0.62} ${head - 10}Z`} fill="#ff8fb8" />
          <path d={`M${w * 0.5} ${head + 14}V${waist - 6}`} stroke="#ff6f91" strokeWidth="2.5" />
          <rect x={w * 0.14} y={waist - 8} width={w * 0.72} height="8" fill="#ff6f91" strokeWidth="2" />
          {/* left arm down, right arm up with the racket (front layer) */}
          {tube(`M${w * 0.18} ${head + 2}Q${w * 0.04} ${head + 24} ${w * 0.12} ${waist - 10}`, '#ffffff', 18)}
          <path d={`M${w * 0.07} ${head + 22}l${w * 0.12} 4`} stroke="#ff6f91" strokeWidth="4" />
          <circle cx={w * 0.12} cy={waist - 8} r="7" fill="#f6a04a" />
          {tube(`M${w * 0.82} ${head + 2}Q${w * 1.04} ${head + 12} ${w * 0.98} ${head - 14}`, '#ffffff', 18)}
          <path d={`M${w * 0.93} ${head + 8}l${w * 0.12} -3`} stroke="#ff6f91" strokeWidth="4" />
        </g>
      )
    },
    skull: (w) => (
      <g>
        {ear(w * 0.16, 26, 23, -18, '#f6a04a', '#fff3df')}
        {ear(w * 0.84, 26, 23, 18, '#f6a04a', '#fff3df')}
        {/* pink hair locks falling past the cheeks */}
        <path d="M8 44Q-8 86 2 126Q12 118 16 106Q10 78 20 52Z" fill="#ff7eb0" />
        <path d={`M${w - 8} 44Q${w + 8} 86 ${w - 2} 126Q${w - 12} 118 ${w - 16} 106Q${w - 10} 78 ${w - 20} 52Z`} fill="#ff7eb0" />
        <path d={`M4 70Q4 14 ${w / 2} 14Q${w - 4} 14 ${w - 4} 70Q${w - 4} 110 ${w / 2} 112Q4 110 4 70Z`} fill="#f6a04a" />
        {/* cream fox face + pink fringe */}
        <path d={`M10 82Q22 72 38 80Q50 86 62 80Q78 72 90 82Q92 110 50 111Q8 110 10 82Z`} fill="#fff3df" stroke="none" />
        <path d={`M6 56Q10 12 ${w / 2} 14Q${w - 10} 12 ${w - 6} 56Q${w * 0.8} 34 ${w * 0.66} 48Q${w * 0.52} 28 ${w * 0.4} 46Q${w * 0.26} 30 6 56Z`} fill="#ff7eb0" />
        {gloss(w * 0.3, 26, 10, 4, -30, 0.45)}
      </g>
    ),
    under: (
      <g>
        <ellipse cx="0" cy="12" rx="4.5" ry="3.4" fill={INK} strokeWidth="2" />
        <ellipse cx="-27" cy="15" rx="7" ry="4" fill="#ff6f91" opacity=".55" stroke="none" />
        <ellipse cx="27" cy="15" rx="7" ry="4" fill="#ff6f91" opacity=".55" stroke="none" />
      </g>
    ),
    over: () => (
      <g stroke={OL} strokeWidth="2.5" strokeLinecap="round">
        <path d="M-28 -7L-33 -11M-27 -2L-33 -3" />
        <path d="M28 -7L33 -11M27 -2L33 -3" />
      </g>
    ),
    top: (w) => (
      <g>
        {/* goggles on the head */}
        <rect x={w * 0.17} y="12" width={w * 0.66} height="17" rx="8.5" fill="#ff6f91" />
        <rect x={w * 0.23} y="15.5" width={w * 0.25} height="10" rx="5" fill="#c9b6ff" stroke="none" />
        <rect x={w * 0.52} y="15.5" width={w * 0.25} height="10" rx="5" fill="#c9b6ff" stroke="none" />
        {gloss(w * 0.3, 18, 4, 1.5, 0, 0.8)}
        {/* yellow X hair clip */}
        <path d={`M${w * 0.74} 38l9 9m0 -9l-9 9`} stroke={OL} strokeWidth="8" strokeLinecap="round" />
        <path d={`M${w * 0.74} 38l9 9m0 -9l-9 9`} stroke="#ffd23f" strokeWidth="4.5" strokeLinecap="round" />
        {/* the shuttlecock she forgot in her hair */}
        <g transform={`translate(${w * 0.1} 34) rotate(-35)`}>
          <path d="M-8 -24H8L4 -4H-4Z" fill="#ffffff" strokeWidth="2.5" />
          <path d="M-3 -23L-2 -5M3 -23L2 -5M0 -23V-5M-7 -16H7" stroke="#c9ced8" strokeWidth="1.2" />
          <path d="M-5.5 -4H5.5Q5.5 5 0 5Q-5.5 5 -5.5 -4Z" fill="#ff8fb8" strokeWidth="2.5" />
        </g>
      </g>
    ),
    front: (w, _h, head) => (
      // badminton racket in the raised right hand
      <g transform={`translate(${w * 0.98} ${head - 16}) rotate(16)`}>
        <rect x="-3.5" y="-32" width="7" height="34" rx="3.5" fill="#ff6f91" strokeWidth="2.5" />
        <ellipse cx="0" cy="-52" rx="14" ry="19" fill="none" stroke={OL} strokeWidth="8" />
        <ellipse cx="0" cy="-52" rx="14" ry="19" fill="#ffffff" fillOpacity=".35" stroke="#ff6f91" strokeWidth="4" />
        <path d="M-7 -68V-36M0 -70V-34M7 -68V-36M-12 -60H12M-13 -52H13M-12 -44H12" stroke="#ffd1e4" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="7.5" fill="#f6a04a" />
      </g>
    ),
  },
  {
    // 05 GUY, The Good Vibes: raccoon, round head, mask, round glasses, green beanie, cream sweater,
    // sitting cross-legged with a plain silver laptop, striped tail.
    name: 'Guy',
    x: 568,
    w: 118,
    cm: 165,
    sit: true,
    head: 104,
    fx: 61,
    fy: 64,
    er: 9.5,
    eg: 17,
    my: 22,
    fur: '#3d3d46',
    ring: true,
    lean: 0.6,
    hop: 0.6,
    mark: [104, 12],
    moods: {
      idle: face('relaxed', 'lid', 'smile', [0, 0, 0, 0], { lid: 0.35 }),
      watch: face('thinking', 'open', 'hmm', [-12, -6, 4, 1], { mark: 'dots' }),
      away: face('relaxed', 'closed', 'smile'),
      wrong: face('surprised', 'wide', 'o', [0, -7, 0, -7], { mark: '!' }),
      happy: face('laughing', 'happy', 'open', [0, -6, 0, -6], { mark: 'sparkle' }),
    },
    back: (w, h) => (
      // fluffy striped tail curling up on his right
      <g className="crew-tail" style={{ transformOrigin: '0% 90%' }}>
        {tube(`M${w * 0.8} ${h - 26}C${w * 1.06} ${h - 22} ${w * 1.16} ${h - 60} ${w * 1.04} ${h - 96}`, '#8d8d96', 24)}
        <path d={`M${w * 0.8} ${h - 26}C${w * 1.06} ${h - 22} ${w * 1.16} ${h - 60} ${w * 1.04} ${h - 96}`} fill="none" stroke="#4a3b30" strokeWidth="24" strokeDasharray="9 12" strokeDashoffset="-14" />
      </g>
    ),
    body: (w, h, head) => (
      <g>
        {/* crossed legs + sneakers */}
        <path d={`M${w * 0.03} ${h - 6}Q${w * 0.03} ${h - 36} ${w * 0.3} ${h - 36}H${w * 0.7}Q${w * 0.97} ${h - 36} ${w * 0.97} ${h - 6}Q${w * 0.97} ${h} ${w * 0.88} ${h}H${w * 0.12}Q${w * 0.03} ${h} ${w * 0.03} ${h - 6}Z`} fill="#2f7d4f" />
        <path d={`M${w * 0.3} ${h - 22}Q${w * 0.5} ${h - 4} ${w * 0.7} ${h - 22}`} stroke={OL} strokeWidth="2.5" fill="none" />
        <ellipse cx={w * 0.1} cy={h - 12} rx="12" ry="10" fill="#f3e7c6" />
        <ellipse cx={w * 0.9} cy={h - 12} rx="12" ry="10" fill="#f3e7c6" />
        <path d={`M${w * 0.03} ${h - 14}Q${w * 0.1} ${h - 2} ${w * 0.17} ${h - 6}M${w * 0.97} ${h - 14}Q${w * 0.9} ${h - 2} ${w * 0.83} ${h - 6}`} stroke="#5b4636" strokeWidth="3.5" fill="none" />
        {/* oversized cream sweater with a mint rib collar */}
        <path d={`M${w * 0.13} ${h - 28}V${head + 4}Q${w * 0.13} ${head - 14} ${w * 0.33} ${head - 14}H${w * 0.67}Q${w * 0.87} ${head - 14} ${w * 0.87} ${head + 4}V${h - 28}Z`} fill="#f3e7c6" />
        <path d={`M${w * 0.32} ${head - 12}Q${w * 0.5} ${head + 4} ${w * 0.68} ${head - 12}`} stroke="#9be3c4" strokeWidth="7" fill="none" strokeLinecap="round" />
        {/* arms to the keyboard */}
        {tube(`M${w * 0.16} ${head}Q${w * 0.02} ${head + 22} ${w * 0.2} ${h - 42}`, '#f3e7c6', 18)}
        {tube(`M${w * 0.84} ${head}Q${w * 0.98} ${head + 22} ${w * 0.8} ${h - 42}`, '#f3e7c6', 18)}
      </g>
    ),
    skull: (w, _h, head) => (
      <g>
        {ear(w * 0.19, 26, 16, -20, '#8d8d96', '#f2ead8')}
        {ear(w * 0.81, 26, 16, 20, '#8d8d96', '#f2ead8')}
        <ellipse cx={w / 2} cy={head / 2 + 6} rx={w * 0.48} ry={head * 0.5} fill="#9a9aa3" />
        {/* cream cheek fluff */}
        <path d={`M${w * 0.1} ${head * 0.66}Q${w * 0.5} ${head * 0.9} ${w * 0.9} ${head * 0.66}Q${w * 0.84} ${head * 1.04} ${w / 2} ${head * 1.06}Q${w * 0.16} ${head * 1.04} ${w * 0.1} ${head * 0.66}Z`} fill="#f2ead8" stroke="none" />
        {gloss(w * 0.28, 30, 11, 5, -30, 0.35)}
      </g>
    ),
    under: (
      <g>
        <path d="M-42 -2Q-31 -19 -6 -10Q0 -8 6 -10Q31 -19 42 -2Q35 17 12 10Q0 7 -12 10Q-35 17 -42 -2Z" fill="#3d3d46" />
        <ellipse cx="0" cy="22" rx="20" ry="13" fill="#f2ead8" />
        <ellipse cx="0" cy="12" rx="5.5" ry="4" fill={INK} strokeWidth="2" />
      </g>
    ),
    over: () => (
      // round glasses
      <g>
        <g fill="#ffffff" fillOpacity=".12" stroke="#f4f4f6" strokeWidth="3.5">
          <circle cx="-17" cy="0" r="14.5" />
          <circle cx="17" cy="0" r="14.5" />
        </g>
        <path d="M-2.5 -2H2.5" stroke="#f4f4f6" strokeWidth="3" />
        <path d="M-26 -6L-22 -10M8 -6L12 -10" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      </g>
    ),
    top: (w) => (
      // dark green beanie, folded band, mint patch
      <g>
        <path d={`M10 38Q8 -2 ${w / 2} -4Q${w - 8} -2 ${w - 10} 38Z`} fill="#2f7d4f" />
        <rect x="4" y="24" width={w - 8} height="16" rx="8" fill="#3f9a63" />
        <path d={`M${w * 0.2} 26V38M${w * 0.32} 26V38M${w * 0.68} 26V38M${w * 0.8} 26V38`} stroke="#2f7d4f" strokeWidth="2" />
        <rect x={w * 0.43} y="27" width="16" height="10" rx="2" fill="#9be3c4" strokeWidth="2" />
        {gloss(w * 0.3, 10, 10, 3.5, -15, 0.3)}
      </g>
    ),
    front: (w, h) => (
      // plain silver laptop on his lap (no logo)
      <g transform={`translate(${w / 2} ${h - 30})`}>
        <rect x="-34" y="-40" width="68" height="40" rx="5" fill="url(#crew-alu)" />
        <rect x="-38" y="-2" width="76" height="7" rx="3.5" fill="#a9b1bf" />
        {gloss(-18, -30, 11, 3, -20, 0.6)}
      </g>
    ),
  },
]

function Lid({ x, r, a, fur }: { x: number; r: number; a: number; fur: string }) {
  const R = r + 2.5 // a bit bigger than the eye, to cover its outline
  const y = -r + 2 * r * a // lid edge
  const dR = Math.sqrt(Math.max(0, R * R - y * y))
  const dr = Math.sqrt(Math.max(0, r * r - y * y))
  return (
    <g>
      <path d={`M${x - dR} ${y}A${R} ${R} 0 ${a > 0.5 ? 1 : 0} 1 ${x + dR} ${y}Z`} fill={fur} stroke="none" />
      <path d={`M${x - dr - 1.5} ${y}Q${x} ${y + 2.5} ${x + dr + 1.5} ${y}`} fill="none" stroke={OL} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function Eyes({ m, f }: { m: Member; f: Face }) {
  const { er: r, eg: g } = m
  const xs = [-g, g]
  const line = m.line ?? INK
  const caret = (x: number) => `M${x - r} 3Q${x} ${-r * 1.3} ${x + r} 3` // ^ happy, closed
  if (f.eyes === 'shades') return null // Hymm's shades cover them (over layer)
  if (f.eyes === 'happy' || f.eyes === 'closed') {
    const d = f.eyes === 'happy' ? caret : (x: number) => `M${x - r} -1Q${x} ${r * 0.9} ${x + r} -1`
    return (
      <g className="crew-eyes crew-eyes-still" fill="none" stroke={line} strokeWidth="4" strokeLinecap="round">
        {xs.map((x) => (
          <path key={x} d={d(x)} />
        ))}
      </g>
    )
  }
  if (f.eyes === 'heart') {
    return (
      <g className="crew-eyes crew-eyes-still">
        {xs.map((x) => (
          <path key={x} className="crew-heart" d={heart(x, r * 1.3)} fill="#ff3d6e" stroke={OL} strokeWidth="2.5" />
        ))}
      </g>
    )
  }
  const size = f.eyes === 'wide' ? 1.15 : 1
  const pr = r * (f.eyes === 'wide' ? 0.36 : f.eyes === 'sparkle' ? 0.62 : 0.5)
  const shut = (k: number) => f.eyes === 'wink' && k === 1
  return (
    <g className="crew-eyes">
      {xs.map((x, k) =>
        shut(k) ? (
          <path key={x} d={caret(x)} fill="none" stroke={line} strokeWidth="4" strokeLinecap="round" />
        ) : (
          <circle key={x} cx={x} cy="0" r={r * size} fill={m.sclera ?? '#fff'} stroke={m.ring ? OL : 'none'} strokeWidth="2.5" />
        ),
      )}
      {/* distracted: looking up and away (overrides the gaze transform) */}
      <g className="crew-pupils" fill={m.pupil ?? INK} stroke="none" style={f.eyes === 'up' ? { transform: `translate(${-r * 0.3}px, ${-r * 0.42}px)` } : undefined}>
        {xs.map((x, k) =>
          shut(k) ? null : (
            <g key={x}>
              {m.slit ? <ellipse cx={x} cy="0" rx={pr * 0.55} ry={pr * 1.25} /> : <circle cx={x} cy="0" r={pr} />}
              <circle cx={x + pr * 0.4} cy={-pr * 0.45} r={Math.max(1.4, pr * 0.32)} fill="#fff" />
              {f.eyes === 'sparkle' && <circle cx={x - pr * 0.38} cy={pr * 0.42} r={pr * 0.17} fill="#fff" />}
            </g>
          ),
        )}
      </g>
      {f.eyes === 'lid' && xs.map((x) => <Lid key={x} x={x} r={r} a={f.lid ?? 0.35} fur={m.fur} />)}
    </g>
  )
}

function Brows({ m, f }: { m: Member; f: Face }) {
  const [len, sw] = m.brow ?? [13, 4]
  const y = -m.er - 9
  const [la, ly, ra, ry] = f.brows
  return (
    <g stroke={m.line ?? INK} strokeWidth={sw} strokeLinecap="round">
      <path className="crew-brow-l" d={`M${-m.eg - len / 2} ${y}h${len}`} style={{ transform: `translateY(${ly}px) rotate(${la}deg)` }} />
      <path className="crew-brow-r" d={`M${m.eg - len / 2} ${y}h${len}`} style={{ transform: `translateY(${ry}px) rotate(${ra}deg)` }} />
    </g>
  )
}

function Mouth({ m, f }: { m: Member; f: Face }) {
  const s = m.mw ?? 1
  const line = { fill: 'none', stroke: m.line ?? INK, strokeWidth: 3.5, strokeLinecap: 'round' as const }
  const shapes: Record<Mouth, ReactNode> = {
    smile: <path d={`M${-8 * s} -2Q0 ${7 * s} ${8 * s} -2`} {...line} />,
    small: <path d="M-5 0Q0 4 5 0" {...line} />,
    smirk: <path d={`M${-8 * s} 1Q${s} ${5 * s} ${9 * s} ${-3 * s}`} {...line} />,
    grin: (
      <g stroke={OL} strokeWidth="2.5" strokeLinejoin="round">
        <path d={`M${-12 * s} -3Q0 ${15 * s} ${12 * s} -3Z`} fill="#fff" />
        <path d={`M${-10 * s} 1.5H${10 * s}`} strokeWidth="1.5" />
      </g>
    ),
    open: (
      <g stroke={OL} strokeWidth="2.5" strokeLinejoin="round">
        <path d={`M${-9 * s} -2Q0 ${15 * s} ${9 * s} -2Z`} fill="#6b1d38" />
        <ellipse cx="0" cy={4.5 * s} rx={4.5 * s} ry={2.3 * s} fill="#ff7aa8" stroke="none" />
      </g>
    ),
    o: <ellipse cx="0" cy="3" rx="4" ry="5" fill="#6b1d38" stroke={OL} strokeWidth="2" />,
    flat: <path d="M-6 1H6" {...line} />,
    frown: <path d="M-8 5Q0 -3 8 5" {...line} />,
    wavy: <path d="M-9 2Q-6.75 -1.5 -4.5 2T0 2T4.5 2T9 2" {...line} strokeWidth={3} />,
    hmm: <path d="M0 2Q2.5 -1 5 2T10 2" {...line} />,
  }
  return (
    <g transform={`translate(0 ${m.my})`}>
      <g key={f.mouth} className="crew-pop">
        {shapes[f.mouth]}
      </g>
    </g>
  )
}

function MarkIcon({ kind }: { kind: Mark }) {
  const ol = { stroke: OL, strokeWidth: 2.5, strokeLinejoin: 'round' as const }
  const twice = (d: string, color: string, width: number) => (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={OL} strokeWidth={width + 5} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  )
  switch (kind) {
    case '!':
      return (
        <g fill="#ffd23f" {...ol}>
          <rect x="-4" y="-26" width="8" height="18" rx="4" />
          <circle cx="0" cy="-1" r="4" />
        </g>
      )
    case '?':
      return (
        <g>
          {twice('M-6 -18Q-6 -26 1 -26Q8 -26 8 -19Q8 -14 1 -11V-7', '#ffd23f', 4.5)}
          <circle cx="1" cy="0" r="3.6" fill="#ffd23f" {...ol} />
        </g>
      )
    case 'zz':
      return (
        <g>
          {twice('M0 -10h8l-8 9h8', '#cfe8ff', 3)}
          {twice('M12 -24h6l-6 7h6', '#cfe8ff', 2.5)}
        </g>
      )
    case 'sparkle':
      return (
        <g fill="#ffd23f" {...ol}>
          <path d={star(0, -10, 10)} />
          <path d={star(14, -24, 5.5)} />
        </g>
      )
    case 'sweat':
      return <path d="M0 -12Q7 -2 4 3Q0 7 -4 3Q-7 -2 0 -12Z" fill="#8fd3ff" {...ol} />
    case 'dots':
      return (
        <g fill="#ffffff" {...ol}>
          <circle cx="0" cy="-4" r="3.2" />
          <circle cx="9" cy="-11" r="4" />
          <circle cx="20" cy="-20" r="5" />
        </g>
      )
    case 'note':
      return (
        <g>
          {twice('M3 -26V-6', '#ffd23f', 3)}
          <path d="M3 -26Q12 -24 13 -15Q9 -20 3 -20Z" fill="#ffd23f" {...ol} />
          <ellipse cx="-1" cy="-5" rx="5.5" ry="4" transform="rotate(-20 -1 -5)" fill="#ffd23f" {...ol} />
        </g>
      )
  }
}

// Back row first: Tang (the leader) stands in front of his neighbours.
const byName = (n: string) => members.find((m) => m.name === n)!
const drawOrder = ['Opor', 'Hymm', 'Tang', 'Game', 'Guy'].map(byName)
const wave = [...members].sort((a, b) => a.x - b.x) // lean / jump ripple from left to right

function Character({ m, mood }: { m: Member; mood: CrewMood }) {
  const h = heightOf(m.cm) * (m.sit ? 0.82 : 1)
  const f = m.moods[mood]
  const i = wave.indexOf(m)
  const markAt = f.mark === 'sweat' ? [m.w * 0.06, m.head * 0.42] : m.mark
  return (
    <g
      transform={`translate(${m.x} ${GROUND - h})`}
      data-member={m.name}
      data-expr={f.name}
      style={{ ['--lean' as string]: m.lean ?? 1, ['--hop' as string]: m.hop ?? 1 }}
    >
      <g className="crew-lean" style={{ ['--i' as string]: i }}>
        <g className="crew-grow" style={{ ['--i' as string]: i }}>
          <g stroke={OL} strokeWidth={SW} strokeLinejoin="round">
            {m.back?.(m.w, h, m.head)}
            {m.body(m.w, h, m.head)}
            {m.skull(m.w, h, m.head)}
            <g className="crew-face" style={{ ['--turn' as string]: `${-m.w * 0.2}px` }}>
              <g transform={`translate(${m.fx} ${m.fy})`}>
                {m.under}
                <Brows m={m} f={f} />
                <Eyes m={m} f={f} />
                {m.over?.(f)}
                <Mouth m={m} f={f} />
              </g>
            </g>
            {m.top?.(m.w, h, m.head)}
            {m.front?.(m.w, h, m.head)}
          </g>
          {f.mark && (
            <g transform={`translate(${markAt[0]} ${markAt[1]})`}>
              <g key={mood} className="crew-mark">
                <MarkIcon kind={f.mark} />
              </g>
            </g>
          )}
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
      // Measured (strokes + sway included): top = Tang's sparkle at the top of his jump;
      // left = Hymm's key while he recoils; right = Guy's tail; bottom = just under the shoes.
      viewBox="-30 62 752 350"
      aria-hidden="true"
      data-testid="crew"
      data-mood={mood}
      data-phase={phase}
      className="crew block h-auto w-full"
      style={{ ['--px' as string]: `${px}px`, ['--py' as string]: `${py}px` }}
    >
      <defs>
        <radialGradient id="crew-glow-cyan">
          <stop offset="0" stopColor="#3ef0ff" stopOpacity=".85" />
          <stop offset="1" stopColor="#3ef0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="crew-glow-ice">
          <stop offset="0" stopColor="#8fe0ff" stopOpacity=".85" />
          <stop offset="1" stopColor="#8fe0ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="crew-alu" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1f3f8" />
          <stop offset="1" stopColor="#aeb6c4" />
        </linearGradient>
        <linearGradient id="crew-gold-lens" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f08c00" />
        </linearGradient>
      </defs>
      <g className="crew-letters" fill="#fff">
        {['R', 'A', 'I'].map((l, i) => (
          <text key={l} x={190 + i * 160} y={GROUND} textAnchor="middle" className="crew-letter" style={{ ['--i' as string]: i }}>
            {l}
          </text>
        ))}
      </g>
      <path d={`M-6 ${GROUND + 1.5}H706`} stroke="#fff" strokeOpacity=".28" strokeWidth="3" strokeLinecap="round" />
      {/* key: a new wrong attempt remounts the crew so the shake replays */}
      <g key={mood === 'wrong' ? `w${wrongKey}` : 'crew'}>
        {drawOrder.map((m) => (
          <Character key={m.name} m={m} mood={mood} />
        ))}
      </g>
    </svg>
  )
}
