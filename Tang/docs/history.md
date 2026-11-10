# History: what we did (newest first)

Short update log so any session can continue. Details live in plans, decisions, and the problem log.

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
