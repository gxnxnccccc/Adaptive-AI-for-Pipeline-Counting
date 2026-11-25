# History: what we did (newest first)

Short update log so any session can continue. Details live in plans, decisions, and the problem log.

## 2026-11-25 (Wed)
**Done**
- Login crew v4: Tang's 5 character prompts integrated (designer-toy style; Tang centre front with crossed arms + glowing headphones; Opor with laptop glow + backpack; Hymm in a varsity jacket with key; Game with racket + forgotten shuttlecock; Guy sitting with his laptop). Each member's 4 prompt expressions are wired to the 5 login states; idle tails, glow and key move. Prompts saved word for word: `docs/design/character-prompts.md`; sheet of all states: `docs/design/img/login-v4-crew-expressions.png`.
**Next**
- Tang: reopen the SPDS shortcut and check the crew. After this, freeze features and rehearse the 30 Nov demo.

## 2026-11-24 (Mon)
**Done**
- 12 screen-review fixes (toast at the bottom, old messages cleared after detection, "review first" instead of a greyed picker, Photo OK chip, to-check labels say this photo / all photos, crop view fits added boxes, duplicate DO warns once, little-data rule for the rate trend + KPI, Login: one error place, no build stamp on phones, Forgot line aligned, 100% label not clipped).
- Processing: liquid glass menu pill (sidebar + phone tabs), files scatter across the drop zone on hover, camera rises + flashes before the live view.
- Login v3: animal crew from Tang's sheets (panther, wolf, gorilla, fox, raccoon; names removed), headline "Adaptive AI for Pipeline Counting" in a bold condensed font (Anton now, Sublime when installed), blob button with seigaiha waves.
- Dashboard: glassmorphism (translucent cards on a blue-and-white backdrop, KPI cards lift on hover).
**Next**
- Tang: try everything on the SPDS shortcut; install Sublime on the demo PC if the licence is bought. Stop adding features: rehearse the 30 Nov demo.

## 2026-11-17 (Mon)
**Done**
- Design-week "What to fix" built: Login crew gap + small build stamp, duplicate photos skipped, quiet compression line, numbered thumbnails, Cancel as a text link, Draft = "Not confirmed yet", model-vs-actual list under 3 batches. 8 screen specs in `docs/design/screens/` (KPI delta left for Later, no Figma).
- Tang opens the app with ONE Desktop shortcut "SPDS" (`demo/make-shortcut.bat`); `SPDS.exe` and the exe build scripts removed.
- All 6 remaining design-week Demo items built: crew jump on correct login, P1 photo tips card (good/bad examples), green "photo OK" chip, zoom/pan on the result photo, keys Z (undo) / N (next box to check), Recent row -> batch details dialog. Checks: 226 vitest, tsc, eslint, 99 pytest, browser run desktop + phone with 0 console errors.
- Debug pass: fixed the Dashboard React key error (`ScanLens` icon); tests now fail on any `console.error` (fixed 10 hidden `act()` warnings). Checks: web tsc + eslint + 208 vitest + build, api 99 pytest, browser click-through desktop + phone with 0 console errors / failed requests / sideways scroll.

## 2026-11-16 (Sun)
**Done**
- UI review (screens at 1280 + 375) -> fixed: struck-through "Forgot?", Result phone order, silent disabled Submit, "03/04" tags, sidebar subtitle wrap, placeholder contrast.
- New brand theme (deep blue / white / pink) + fonts Mitr / Anuphan / Spline Sans Mono across the app.
- Login redesigned: "RAI" morphs into the 5-member crew; they lean in while typing, turn away when the password is shown, shake their heads on a wrong password. Spec: `docs/design/login-crew.md`.
- Mock login password = `spds`. Demo bundle rebuilt. Checks: web tsc + eslint + 198 vitest, api 99 pytest.
- `SPDS.exe` fix: `demo/build-exe.bat` + `spds_launcher.py` (rule added to CLAUDE.md).
- Design week: 4 hi-fi frames + Fix / Demo / Later notes (`docs/design/design-week.md`). Figma upload from the cloud was blocked (problem-log).
- 3 Demo items from design week built: Caps Lock warning (Login), "show only boxes to check" toggle on the to-check chip (Result, confident boxes fade), Export CSV of the latest 100 batches (Dashboard). Checks: tsc + eslint + 208 vitest; checked in the browser.
**Open**
- Tang: switch his repo folder to the branch once, then run `demo/build-live-exe.bat` once; after that reopening SPDS.exe updates it.
- Tang to confirm fonts + demo password. Dashboard day-over-day deltas (needs API field) -> backlog.

## 2026-11-10 (Tue)
**Done**
- One light design for the whole app (from `capture-upload.html`); dark ui-v2 look dropped, 4 dark previews deleted. Processing rebuilt to match the preview (CTA button, no auto-navigate).
- API `DEMO_MEMORY` in-memory mode + `/health` `storage` field. Docker compose (api + web/nginx on 8080). Tests: api 98, web 196 pass.
**Open**
- First real `docker compose up --build` (Docker not installed here).

## 2026-11-04 (Wed)
**Done**
- Figma Make read via MCP -> `docs/design/capture-upload.md` (now marked REFERENCE, not final).
- Decisions logged: Figma = reference only, design in code later; Figma-first step dropped; `SUPABASE_SECRET_KEY`; limits 10 files / 15 MB; TypeScript pinned ~5.9.
- Supabase project "Capstone" connected to Claude (MCP); `api/.env` created (gitignored), secret key still placeholder.
- `docs/plans/multi-upload.md` tasks 2-6 done: FastAPI scaffold, OpenCV mock detector (downscale to 1280 px, ~1 s per 12 MP), `POST /api/counts`, web scaffold + `detection.ts` adapter, multi-upload Capture screen.
- `docs/plans/app-flow.md` tasks 1-8 done (from Tang's 6 reference screenshots, function + buttons only): migrations v1 + `excluded` column (not applied), persist/confirm/records/stats API, mock login + shell, New Detection steps 1-3, success screen, Records (filters, search, paging, CSV), Dashboard KPIs. Fix found in review: removed photos are excluded on confirm via `image_ids`.
- HTML preview `docs/design/preview/capture-upload.html` (mobile + PC toggle) fixed and copied to `C:\Users\Admin\Desktop\Capstone\`.
- Checks I re-ran myself: api ruff + 62 pytest, web tsc + lint + 65 vitest.

**Not done / unverified**
- Nothing committed or pushed (branch `tang/setup`). Migrations not applied. SupabaseRepo never run live. UI never viewed in a browser.
- No formal `reviewer` PASS; `scribe` has not written problem-log rows.
- Demo item 4 (add/remove single pipe), compression (item 7), guidance v1 (blur/bright), real model, per-record detail view, preview of the full flow.

**Problem-log rows to write (scribe)**
| Area | Problem | Fix |
|---|---|---|
| api | HoughCircles over-counted touching circles (61 vs 30) | median-radius filter + overlap suppression |
| api | 12 MP image took ~7 s | downscale to 1280 px before detection |
| api | `zoneinfo` fails on Windows | add `tzdata` |
| web | `typescript@latest` (7.x) conflicts with typescript-eslint / openapi-typescript | pin ~5.9 |
| web | vitest 5 fails on mocked rejected promise even if caught | stub `fetch` instead |
| web | missing `web/.env` -> requests to "undefined/api/counts" | copy from `.env.example` |
| tooling | key type changed to `sb_secret_`; placeholder check let it through at first | stricter check in config |

## Next
1. Tang: full secret key into `api/.env`; approve + apply 2 migrations; commit on `tang/app-flow`, push, PR, 1 reviewer.
2. Claude: reviewer pass, scribe rows, live test of Supabase paths, full-flow HTML preview.
3. Ask: demo item 4 in or out? Supabase owner (Hymn)? ML answers on OPEN contract fields.
