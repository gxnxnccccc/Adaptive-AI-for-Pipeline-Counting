# Plan: brand theme + "RAI crew" login + UI review fixes

Request: Tang, 2026-11-16. UI review (same day) found 8 issues; Tang asked to fix all of them, switch the theme to his 3-colour palette, pick new fonts, and redesign Login with the 5 team members as cartoon characters.

| # | Task | Done when |
|---|---|---|
| 1 | Theme tokens: Deep blue `#09318D`, Pure white `#FFFFFF`, Bubblegum pink `#FD91CC` (+ derived ink/soft tones) in `web/src/index.css` | every page uses the new colours via tokens; text contrast >= 4.5:1 (pink is never used for text on white) |
| 2 | Fonts: Mitr (display, H1 + brand), Anuphan (body, Thai + Latin), DM Mono (IDs, numbers) via `@fontsource` | IBM Plex / JetBrains removed from `package.json` and `main.tsx`; demo still works offline |
| 3 | Login left half = `LoginCrew`: "RAI" letters melt into 5 characters (Tang, Opor, Hymm, Game, Guy), flat shapes like the reference picture | intro plays once; skipped under `prefers-reduced-motion` |
| 4 | Crew reactions: typing -> lean in + eyes follow the text; show password -> turn away; wrong password -> lean back + head shake | each mood visible in a screenshot; covered by Login tests |
| 5 | Mock login gets a "wrong password" case: demo password `spds` (shown on the card) | wrong password shows an error + triggers the shake; correct password signs in |
| 6 | Review fixes: no struck-through "Forgot?"; Result phone order (confirm form right after the photo); submit button explains what's missing above it and focuses the first bad field; drop "03 / 04" tags; one-line sidebar subtitle; darker placeholder | screenshots at 1280 and 375 |
| 7 | Tests + build + demo bundle | `tsc`, `eslint`, `vitest` pass; `npm run build:demo` refreshed `demo/site` |

Out of scope: Dashboard day-over-day deltas (needs an API field; backlog).
