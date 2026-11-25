# Screen: Login with the RAI crew   Ref: Tang's palette + flat-character pictures (chat, 2026-11-16)   Plan: `docs/plans/brand-crew-login.md`

## v4, 2026-11-25: character design integrated (current)
Source: Tang's 5 character prompts (`character-prompts.md`) + his sheets. Screenshots: `img/login-v4-character-design.png`, all states: `img/login-v4-crew-expressions.png`.

**Style:** designer-toy chibi (big heads), thick dark outlines, glossy highlights. Left to right: Hymm, Opor, **Tang in the centre, in front** (the leader), Game, Guy. Heights still follow the real ones; Guy sits cross-legged (his hero pose).

| Member | Drawn from the prompt | Idle motion | Lean / jump |
|---|---|---|---|
| Tang, black panther | arms crossed, yellow cat eyes, purple fur sheen, techwear jacket (purple + cyan), oversized headphones with a cyan glow, long tail, cheek plaster | headphone glow pulses, tail sways | normal / a bit higher |
| Opor, wolf | sleepy eyes, visor goggles, oversized white hoodie, backpack, cargo pants, laptop with an ice-blue light bar + screen glow, fluffy tail | laptop glow pulses | half (introvert) / low |
| Hymm, gorilla | wide grin, heavy brows, red varsity jacket (striped rib, snaps, gold "H"), gold chain, gold shades on his head, plain red key held up | key jiggles | a bit less / a bit less |
| Game, fox | big sparkly eyes, pink + orange hair, goggles, X clip, white sporty jacket, lavender skirt, striped socks, racket, big tail, **a shuttlecock she forgot in her hair** | tail wags fast | most / highest |
| Guy, raccoon | round head, mask, round glasses, green beanie, cream sweater, sitting with a plain silver laptop, striped tail | tail sways | little / small bounce |

**4 expressions each, wired to the login states** (`data-expr` on each member; test: `LoginCrew.test.tsx`)
| State | Tang | Opor | Hymm | Game | Guy |
|---|---|---|---|---|---|
| Page open (idle) | confident: half-lid + smirk | tired: sleepy lids | smug: one brow up, grin | excited: sparkly eyes | relaxed: soft lids, smile |
| Typing (watch) | competitive: brows down, grin | focused: narrowed eyes | cool: shades slide down | surprised: wide eyes, "o" | thinking: brow up, "…" |
| Password shown (away) | confident: eyes closed | tired: dozes off, "zz" | cool: shades on | distracted: looks up, "♪" | relaxed: eyes closed |
| Wrong password | angry: "!" (grumpy, not scary) | surprised: sweat drop | laughing | confused: "?" | surprised: "!" |
| Correct password | excited: ^^ + sparkle | happy: ^^ | lovestruck: heart eyes | excited: wink + sparkle | laughing: ^^ + sparkle |

All motion is CSS and stops under reduced motion (the expressions still change). No brand logos (see `character-prompts.md`).

## Older notes

**Update 2026-11-24 (Tang's character sheets):** the crew are now animals: Tang = black panther (purple/black/cyan techwear, headphones), Opor = wolf (silver/ice blue/navy hoodie, goggles, laptop), Hymm = gorilla (red/gold/charcoal, gold shades + chain, red key), Game = fox (pink/orange/cream, goggles, badminton racket), Guy = raccoon (mint/cream/brown, beanie, round glasses, headphones). Names under them removed. No brand logos on props. Headline = "Adaptive AI for Pipeline Counting" (English only) in `--font-brand` (Sublime Bold Condensed if installed on the PC, else free Anton). Sign in = blob button with seigaiha waves. Screenshot: `img/login-v3-animal-crew.png`. The older notes below describe v2 (flat people).

Designed in code (decision 2026-11-04), not Figma. Screenshots: `img/login-crew-{idle,watch,away,wrong}.png`.

## Brand tokens (whole app, `web/src/index.css`)
| Token | Hex | Use |
|---|---|---|
| `accent` | `#09318D` Deep blue | buttons, links, H1, login left half, focus ring (11.4:1 on white) |
| `surface` | `#FFFFFF` Pure white | cards |
| `pink` | `#FD91CC` Bubblegum pink | fills only: active nav tint, current step, corrected-count card, Hymm, logo dot. 2.1:1 on white, so never text |
| `pink-soft` / `pink-ink` | `#FFE6F3` / `#A0105C` | soft pink background / text on it (6.6:1) |
| `tx` / `tx-2` / `tx-3` | `#0A1A4A` / `#3B4770` / `#5A6488` | text, all >= 4.5:1 on `bg` `#F4F6FC` |

Fonts: **Mitr** (display: H1, brand, "RAI"), **Anuphan** (body, Thai + Latin), **Spline Sans Mono** (IDs, counts). All `@fontsource`, offline. Picked to avoid the usual AI defaults (Inter, IBM Plex, JetBrains Mono).

## Layout
- Desktop (>= 900 px): left 1.1fr = deep-blue panel (logo, Mitr tagline, crew); right 0.9fr = sign-in card.
- Phone: blue band on top (logo, tagline, crew at 300 px wide, names hidden), card below.

## Crew (`web/src/components/LoginCrew.tsx`)
| Member | Height | Shape / colour | Traits |
|---|---|---|---|
| Tang | 185 cm (tallest) | tall rectangle, tan skin | comma hair, pink-gold glasses |
| Opor | 183 cm | pill, white | dry spiky hair, gold with black roots |
| Hymm | 180 cm | wide bean, pink | "a bit fat", short tuft, cheeks |
| Game | 165 cm | arch, yellow | long hair, fringe, pink bow, lashes |
| Guy | 165 cm | rectangle, fair skin | two-block hair, braces |

Height in px = (cm - 110) x 4, so the 20 cm gap reads.

## Interactions
| Trigger | Crew |
|---|---|
| Page load | "RAI" rises (0-1.1 s), letters squash flat while the five spring up out of them (1.1-2.1 s). Skipped under reduced motion |
| Idle | look at the viewer, smile, blink now and then |
| Focus in Operator ID / password | lean toward the form, brows up, "o" mouth, eyes follow the text as it gets longer |
| Show password (eye button) | turn away (faces slide to the far side), flat mouth |
| Wrong password | lean back, worried brows, head shake; replays on every wrong try. Field error says the demo password |

## Mock login
Any Operator ID + password `spds` (shown on the pink demo card). Anything else = "wrong password". Not real security.

## Flags
- All motion is CSS (transform only) and turns off under `prefers-reduced-motion`; the error text still explains a wrong password.
- The crew is `aria-hidden`; the panel has an `aria-label` naming the team.
