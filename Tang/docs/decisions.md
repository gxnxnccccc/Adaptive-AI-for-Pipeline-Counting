# Decisions log

One line per decision: date | decision | why | status (proposed / agreed by Tang / agreed by team)

- 2026-11-02 | Dev pipeline = planner -> coder -> tester -> reviewer -> scribe, main session = orchestrator | small gated steps, problem log stays current | agreed (Tang)
- 2026-11-02 | Mock detector behind adapters (`web/src/lib/detection.ts`, `api/app/detector.py`) until the real model exists | Tang isn't blocked by the ML timeline (model = Dec-Jan) | agreed (Tang)
- 2026-11-03 | Tang's scope = web app + API; Guy builds React Native on the same API | least overlap, matches roles | agreed (Tang), confirm with team
- 2026-11-03 | API = FastAPI (Python) | same language as the model team | agreed (Tang), tell Hymn
- 2026-11-03 | Web = Vite + React + TypeScript + Tailwind | fast demo, phone-browser friendly | agreed (Tang)
- 2026-11-03 | Tang's work lives in `Tang/` in the team repo; branch `tang/<feature>` + PR to `main`, 1 review | team can see his work, no conflicts with others | agreed (Tang)
- 2026-11-03 | DB + image storage = Supabase (Postgres + private Storage bucket), accessed only from FastAPI | one service, real SQL, dashboard for the professor | agreed (Tang), confirm owner with Hymn
- 2026-11-03 | UI design = Figma, `designer` agent turns frames into `docs/design/<screen>.md` | design before code, shared look with Guy's RN app | agreed (Tang)
- 2026-11-03 | Skill route = karpathy always; ui-ux-pro-max + shadcn + web-design-guidelines for UI; systematic-debugging for bugs; TDD only for count logic/compression/adapter; slides + weekly doc via Claude app artifacts | light strictness fits 3.5 h/day, clean UI fits a warehouse tool | agreed (Tang), see docs/skill-routes.md
- 2026-11-03 | Claude setup: Claude Code on laptop inside `Tang/` + Claude app Project "SPDS Capstone" | Tang's chosen tools | agreed (Tang)
- 2026-11-04 | Figma is a visual reference only (colors, buttons, cards); real screens are designed in code from `docs/design/<screen>.md` + `ui-ux-pro-max`, mobile-first, Thai + English. No Figma-first step anymore | Figma Make prototype is single-image desktop-only; designing in Figma first would cost 1-2 days before M1 (8 Nov) | agreed (Tang), replaces the 2026-11-03 "UI design = Figma" line
- 2026-11-04 | `SUPABASE_SECRET_KEY` (new key type) replaces `SUPABASE_SERVICE_ROLE_KEY` in `api/.env` | Supabase dashboard issues `sb_secret_` keys for this project | agreed (Tang)
- 2026-11-04 | Upload limits: max 10 files per request, 15 MB per file (`api/app/config.py`) | protects the mock detector; compression (demo item 7) comes later | proposed, confirm with Tang
- 2026-11-04 | TypeScript pinned to ~5.9 in `web/` | TS 7 conflicts with typescript-eslint and openapi-typescript | agreed (coder fix)
- 2026-11-09 | Frontend v2 = 4 pages: Login / Processing (capture + upload + detect) / Result (review + confirm) / Dashboard. Records page merged into Dashboard as "Recent 10"; Submitted page dropped, submit returns to Processing with a toast | fewer pages for the demo flow; replaces the 2026-11-04 Draft 1 / Figma reference | agreed (Tang)
- 2026-11-09 | New look "Dark control room", laptop first + phone OK, Thai + English kept; HTML previews first, Tang approves before any page code | see the look before spending code time on it | agreed (Tang)
- 2026-11-09 | Tap-to-edit corrections saved per box: confirm body `corrections[]`, removed = model pipe index, added = `user_added` box | keeps per-box edits as future training data | agreed (Tang)
- 2026-11-09 | Client-side quality check (dark < 60 luma, bright > 200, blurry < Laplacian variance 100) + compression (long side 2048, JPEG 0.8, keep original if not smaller) | catch bad photos before upload, smaller uploads; thresholds need tuning on real yard photos | proposed
- 2026-11-09 | `GET /api/stats/daily` aggregates in Python over rows fetched from Supabase | simple for the demo; PostgREST max-rows 1000 means silent undercount at high volume -> move to a SQL group-by view/RPC after demo | agreed (Tang), revisit after demo
- 2026-11-09 | Charts = `recharts@3.10.1` (lazy-loaded, +5 kB main) with `react-is@19.3.1` pinned | recharts otherwise resolved react-is 17, incompatible with React 19 | agreed (reviewer)
- 2026-11-09 | Branch `tang/dark-ui` created from `tang/app-flow` (not `main`) | README commit 5b269aa was pushed but is not in `main` | agreed (Tang)
- 2026-11-09 | Fonts self-hosted via `@fontsource` (IBM Plex Sans Thai 400-700, JetBrains Mono 400/500/700) | demo room may have no internet | agreed (Tang)
- 2026-11-09 | Per-photo progress = checking -> compressing per photo, then one shared uploading/detecting phase (one `POST /api/counts` for all photos); upload % optional (task 6c) | no API change, simple flow | agreed (Tang)
- 2026-11-09 | Login allowed while the API is offline, with a warning + "Check again" (Sign in stays enabled) | Tang's answer to the ui-v2 plan flag | agreed (Tang)
- 2026-11-09 | Back to processing keeps the session (photos + box edits); Processing shows a "Back to review" CTA; Detect with an unsent session asks first | Tang: adding photos + detecting again must not lose corrections | agreed (Tang)
- 2026-11-09 | Camera = live `getUserMedia` on laptop / HTTPS; phone over plain http falls back to the native picker (`<input capture>`) | browsers block `getUserMedia` without HTTPS | proposed (Tang hasn't confirmed HTTPS vs picker)
- 2026-11-09 | Hand-rolled ConfirmDialog + Toast instead of new shadcn AlertDialog / sonner deps | no new dependencies for 2 small components | agreed (reviewer)
- 2026-11-09 | Records page + CSV export removed; history = Dashboard "Recent 10" (no filters) | Tang's 4-page choice | agreed (Tang)
- 2026-11-09 | 6c (upload %) and 8d (rebase after Back / form draft) cut for now | scope/usage; demo works without them | proposed (Tang to confirm)
- 2026-11-09 | Dashboard toolbar slot via React Router Outlet context (`lib/shell-context.ts`), not a new React context | smallest change | agreed (reviewer/tester)
- 2026-11-10 | One LIGHT design for the whole app (white cards, blue #2563eb, as `capture-upload.html`); the dark "control room" ui-v2 look is dropped. Token names unchanged, values light; added `--shadow-card`, `--shadow-pop`, radius 16 | Tang: one design, not two | agreed (Tang)
- 2026-11-10 | Processing page copies capture-upload.html; CTA "Upload N" -> "Uploading…" -> "Review results" is a button, the 1.5 s auto-navigate is removed. Tips block, size bar, empty-state art, 2-column layout dropped; checking/compressing shown as "Queued" | match the preview, user stays in control | agreed (Tang)
- 2026-11-10 | `DEMO_MEMORY=true` + no Supabase keys = one shared in-memory repo (single worker, data lost on restart); without the flag the 503 stays. `/health` returns `storage: supabase / memory / none` | demo and Docker work with no keys | agreed (Tang)
- 2026-11-10 | Docker: `Tang/docker-compose.yml` = api (python 3.12 slim, uvicorn :8000) + web (node build -> nginx 1.27, port 8080, same-origin proxy for `/api/` and `/health`, body limit 160m); web API base = `VITE_API_URL ?? ''` | a friend runs `docker compose up --build` and opens localhost:8080, no CORS, no keys | agreed (Tang); first real build still open (Docker not on Tang's PC)
