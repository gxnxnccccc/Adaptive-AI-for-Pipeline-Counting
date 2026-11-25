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
- 2026-11-03 | Figma Make prototype v11 (https://www.figma.com/make/Fcwtli6ARlTTlMDXUnowlj/Steel-Pipe-Detector-UI-Design) = style reference only; flow redesigned for mobile + multi-image + boxes | prototype predates professor requests P1-P5, desktop-only, single image | agreed (Tang)
- 2026-11-03 | Web is responsive, phone and laptop equally, mobile first | workers capture on phone, review on laptop | agreed (Tang)
- 2026-11-03 | Batch = many photos, each photo a different stack; batch total = sum of stacks | one DO (truck load) has many stacks | agreed (Tang)
- 2026-11-03 | Batch fields: DO Number per batch (validated 2 letters + 8 digits, e.g. DX26030043, real company format), pipe size per stack (assumed, confirm), note per stack | link counts to shipments | agreed (Tang)
- 2026-11-03 | Correction = tap box to remove / tap empty to add, plus +/- fallback | positions kept as training data (P6) | agreed (Tang)
- 2026-11-03 | Actual Amount typed by worker is required per stack; AI count + boxes are the check | Tang's choice | agreed (Tang)
- 2026-11-03 | Mismatch rule: typed Actual != box count -> warning, note required, both saved | default proposed by Claude | proposed, confirm with Tang
- 2026-11-03 | Low-confidence pipes highlighted yellow; submit disabled until each is reviewed | count trust | agreed (Tang)
- 2026-11-03 | Guidance (P1) warns with Retake / Use anyway, never blocks | a dark warehouse must not stop work | agreed (Tang)
- 2026-11-03 | UI language = TH/EN toggle, Thai default | workers are Thai | agreed (Tang)
- 2026-11-03 | History = list + detail + filter/search (date, DO Number, pipe size) | find past counts | agreed (Tang)
- 2026-11-03 | Roles = worker + supervisor (supervisor sees all history, edits confirmed counts with change log); demo builds worker flow only, supervisor screens in Figma only | no login in demo | agreed (Tang)
- 2026-11-03 | Real login moved to M5 (Dec) with Supabase | keeps demo scope | agreed (Tang)
- 2026-11-24 | Supabase used now for DB (not SQLite); overrides `docs/plans/backend-minimum.md`; Supabase moved forward from M5 | Tang's request, needed for the demo tables this week | agreed (Tang)
- 2026-11-24 | Primary keys = uuid (`gen_random_uuid()`), API returns them as strings | default for OPEN-4 in mock-api-and-tables plan, no `b_123` style ids | agreed (Tang)
- 2026-11-24 | Dependencies approved: fastapi, uvicorn, python-multipart, pillow, python-dotenv, supabase, pytest, httpx; each added incrementally per task, not all at once | keeps each task small and reviewable | agreed (Tang)
- 2026-11-24 | Image files stored on local disk under `api/data/images/` for now; Supabase Storage bucket later (M5) | no bucket setup needed this week, swap point is `repo.py` only | agreed (Tang)
- 2026-11-24 | Mock detector is deterministic (sha256 of image bytes XOR `MOCK_SEED`, default 0); fixed 10% low-confidence rate and 3% crop padding are mock choices, not contract until ML team confirms | same photo gives same demo answer every run; box format and crop_box source still OPEN (OPEN-1, OPEN-8) | proposed, Tang's yes not yet recorded in this log
- 2026-11-25 | If the batches insert succeeds but the images insert fails, save_batch removes the local files and makes a best-effort delete of the empty batches row (cleanup failure never masks the original error); no real transaction/RPC yet, revisit in M5 | reviewer flagged orphan batch rows in T4 (no half batches) | proposed (reviewer fix, coder implementing), Tang's yes not yet recorded
- 2026-11-25 | POST /api/counts status codes: 422 = no images or missing field; 413 = more than 10 images or a file over 15 MB; 415 = not a decodable image; 500 = save failure, returned with no exception text. Error messages in Thai, naming the image by 1-based position, never the filename | client can show a clear message per case without leaking internals or filenames | proposed, Tang's yes not yet recorded
- 2026-11-25 | Every uploaded image is validated (Pillow decode) before detect and save; one bad file means nothing is saved for the whole request | no half batches; T5 rule | proposed, Tang's yes not yet recorded
- 2026-11-25 | `quality` is a fixed placeholder `{"brightness":"ok","blur":"ok"}`, not a measurement | quality check is demo item 6, not built yet (OPEN-3) | proposed, Tang's yes not yet recorded
- 2026-11-25 | `stored_bytes` == `original_bytes` until compression is built | compression is demo item 7, not built yet (OPEN-3) | proposed, Tang's yes not yet recorded
