# Screen: Login with the RAI crew   Ref: Tang's palette + flat-character pictures (chat, 2026-11-16)   Plan: `docs/plans/brand-crew-login.md`

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
