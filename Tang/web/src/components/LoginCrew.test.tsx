import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LoginCrew, { type CrewMood } from './LoginCrew'

// The 4 expressions each character prompt asks for (docs/design/character-prompts.md).
const PROMPT: Record<string, string[]> = {
  Tang: ['confident', 'excited', 'competitive', 'angry'],
  Opor: ['focused', 'tired', 'happy', 'surprised'],
  Hymm: ['smug', 'laughing', 'cool', 'lovestruck'],
  Game: ['excited', 'confused', 'surprised', 'distracted'],
  Guy: ['relaxed', 'thinking', 'laughing', 'surprised'],
}
// Which one shows in each login state (docs/design/login-crew.md).
const SHOWN: Record<CrewMood, Record<string, string>> = {
  idle: { Tang: 'confident', Opor: 'tired', Hymm: 'smug', Game: 'excited', Guy: 'relaxed' },
  watch: { Tang: 'competitive', Opor: 'focused', Hymm: 'cool', Game: 'surprised', Guy: 'thinking' },
  away: { Tang: 'confident', Opor: 'tired', Hymm: 'cool', Game: 'distracted', Guy: 'relaxed' },
  wrong: { Tang: 'angry', Opor: 'surprised', Hymm: 'laughing', Game: 'confused', Guy: 'surprised' },
  happy: { Tang: 'excited', Opor: 'happy', Hymm: 'lovestruck', Game: 'excited', Guy: 'laughing' },
}
const MOODS = Object.keys(SHOWN) as CrewMood[]

function expressions(mood: CrewMood) {
  const { unmount } = render(<LoginCrew mood={mood} />)
  const shown: Record<string, string> = {}
  for (const g of screen.getByTestId('crew').querySelectorAll('[data-member]')) shown[g.getAttribute('data-member') ?? ''] = g.getAttribute('data-expr') ?? ''
  unmount()
  return shown
}

describe('LoginCrew expressions', () => {
  it.each(MOODS)('%s: each member shows the expression mapped to this state', (mood) => {
    expect(expressions(mood)).toEqual(SHOWN[mood])
  })

  it('across the 5 states every member shows exactly the 4 expressions from their prompt', () => {
    const seen: Record<string, Set<string>> = {}
    for (const mood of MOODS) {
      for (const [member, expr] of Object.entries(expressions(mood))) (seen[member] ??= new Set()).add(expr)
    }
    for (const [member, list] of Object.entries(PROMPT)) expect([...seen[member]].sort()).toEqual([...list].sort())
  })

  it("Hymm's gold shades sit on his head, and slide over his eyes when he plays it cool", () => {
    const shades = (mood: CrewMood) => {
      const { container, unmount } = render(<LoginCrew mood={mood} />)
      const t = (container.querySelector('[data-member="Hymm"] .crew-shades') as SVGGElement).style.transform
      unmount()
      return t
    }
    expect(shades('idle')).toBe('translateY(-38px)')
    expect(shades('watch')).toBe('none')
  })
})
