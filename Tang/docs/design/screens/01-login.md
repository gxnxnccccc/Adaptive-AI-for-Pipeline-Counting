# 01 Login   2026-11-17

Where: `/login`. Requirement: Demo item: sign-in (mock). Real auth = Later.
Image: `../img/spec-01-login.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- Left: brand, tagline, the 5-member crew (RAI intro, then the crew watches the form).
- Right: sign-in card: demo-login note with password `spds`, Operator ID, Password (show/hide, Caps Lock warning), Keep me signed in, API status chip.
- Wrong password: the crew reacts, the field is selected again. Correct: the crew jumps, then Processing opens.

## What to fix
| Issue | Status |
|---|---|
| Crew sat low with an empty gap under the tagline at 1440x900 | ✅ built: empty band trimmed off the top of the drawing, crew 640 → 720 px wide |
| Build stamp read like debug text | ✅ built: 10 px in the bottom-right corner, only in the live app (SPDS shortcut); the built bundle (`demo/site`) has none |
| Big empty grey area right of the card | ⬜ check on the real projector (Tang) |

## Function to add
| Function | When |
|---|---|
| Caps Lock warning under the password | Demo ✅ |
| Crew jumps once on a correct login | Demo ✅ |
| Real sign-in (Supabase Auth) | Later |
| Forgot-password flow | Later |
