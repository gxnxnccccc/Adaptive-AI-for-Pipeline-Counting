# Plan: mock API + Supabase tables (BUILD + DB WEEK, backend part)

Date: 2026-11-24. Planner output. Status: proposed, waiting for Tang's yes on the OPEN items.
Sources read: `docs/requirements.md`, `docs/api-contract.md`, `docs/milestones.md`, `docs/decisions.md`, `docs/plans/backend-minimum.md`. `docs/workflow/` does not exist (blocker list below). `api/` has only `README.md` and `.env.example`, so everything is built from zero.

## TL;DR
- 5 tasks, each 1-1.5 h, ordered. Fits Tue 24 - Wed 25 Nov (two 3 h blocks) with Thu 26 as slip buffer.
- Plan-sheet done-criteria: "web and api run locally, tables exist" and "pick 5 photos on a phone, see per-image status, mock API answers". T5 proves the API half. The phone half is web work (not in this plan).
- Scope lock: Demo items 1 and 2 only. No confirm, no history, no quality check, no compression, no pipe size, no DO Number.
- Tang has to run the migration SQL by hand in the Supabase SQL editor (Supabase MCP not authorized). T3 has a manual step for him.

## Conflict with an existing plan (Tang must pick one)
`docs/plans/backend-minimum.md` (same date) uses SQLite and says "no Supabase until M5". Tang's request here uses Supabase now. This plan follows the newer request. If it is accepted, `backend-minimum.md` should be marked superseded for T1/T2/T4 storage parts. Its T5 (confirm + history), T3 (quality, compression) and T7 stay out of scope until after items 1, 2 are done.

**Resolved 2026-11-24 (Tang yes):** Supabase is the DB now. `docs/plans/backend-minimum.md` is **superseded for the DB choice** (its SQLite + `repo_sqlite.py` storage plan no longer applies). Its other parts (quality, compression, confirm, history) are unchanged and still out of scope for now. Logged in `docs/decisions.md` (2026-11-24).
Also: `docs/decisions.md` (2026-11-03) says Supabase is accessed only from FastAPI and `milestones.md` puts "Supabase DB + image storage" at M5 (20 Dec). Pulling the DB forward to this week is a schedule change, so scribe logs it in `decisions.md` after Tang's yes. Image storage (Supabase Storage bucket) stays M5.

## Priority check
| Item | Demo item | In scope now? |
|---|---|---|
| Scaffold, /health, CORS | 1, 2 (enabler) | yes |
| Mock detector (count, crop_box, pipes[]) | 2 | yes |
| POST /api/counts, 5 images, per-image result | 1, 2 | yes |
| Tables `batches`, `images` + save via API | 2 (stored result), enabler for 5 | yes (Tang asked, plan sheet says tables exist) |
| `quality` and byte fields | 6, 7 | columns exist but filled with placeholders only (see OPEN-3). Real logic = later |
| Confirm, history, `confirmed` set to true | 5 | NO. Column exists, always `false` now |
| Pipe size, DO Number, note, Actual Amount | web-interview additions | NO. Not in tables |

## Blockers and OPEN items (need Tang)
| # | Item | Default used until answered |
|---|---|---|
| BLOCKER-1 | `docs/workflow/` does not exist. Workflow rules were taken from `Tang/CLAUDE.md` and `docs/claude-workflow.md` instead. | Tang confirms nothing is missing, or adds the folder |
| BLOCKER-2 | No Supabase project URL / keys are known to this planner. `api/.env.example` exists. Tang must have a project and fill `api/.env` himself. | T3, T4 wait for it |
| OPEN-1 | Box format (ML team). `api-contract.md` says OPEN. | `[x, y, w, h]` in pixels of the uploaded image. Only `detector.py` knows. Written as an assumption, not a fact. |
| OPEN-2 | Real image files: local disk vs Supabase Storage | **Default: local disk** under `api/data/images/` (gitignored). Tang asked for `samples/` to be gitignored, but `samples/` is Tang's test-photo folder. Runtime copies go to `api/data/`, not `samples/`. Storage = M5 (Supabase Storage bucket). Swap point is `repo.py` only. |
| OPEN-3 | `quality`, `stored_bytes`, `original_bytes` are in the contract response and in the tables, but quality check (item 6) and compression (item 7) are not in scope. | `original_bytes` = real bytes received. `stored_bytes` = real bytes written to disk (equal to original, no compression yet). `quality` = `{"brightness":"ok","blur":"ok"}` as a fixed placeholder, with a code comment saying so. Never shown as a real measurement. |
| OPEN-4 | Id format. Contract examples show `b_123` / `img_1`. | Tables use `uuid` primary keys (`gen_random_uuid()`), the API returns them as strings. The contract examples are only examples. Alternative: `text` ids. Tang decides before T3 (changing later = new migration). |
| OPEN-5 | Upload limits | Max 10 images per request, max 15 MB each, JPEG/PNG/WebP. Plan target is 5 at once; limit leaves headroom. |
| OPEN-6 | Dependencies. Needs Tang's yes (CLAUDE.md: new dependency = ask) | `fastapi`, `uvicorn`, `python-multipart`, `pillow`, `python-dotenv`, `supabase` (or `httpx` + PostgREST), `pytest`, `httpx`. Python 3.11+. |
| OPEN-7 | RLS on the tables | Enable RLS on both tables with NO policies. The API uses the service-role key (bypasses RLS), so the anon/publishable key can read nothing. Safe default until real auth (M5). |
| OPEN-8 | Does the real model provide `crop_box`? (contract OPEN) | Computed inside the mock adapter (pipes bounding box + padding, clamped). |

Business rules still unknown, not needed for these tasks: pipe size list, DO Number placement, mismatch rule, low-confidence threshold. Not planned here.

## Target layout (inside `Tang/api/`)
```
api/
  app/main.py          FastAPI app, CORS, /health, router
  app/schemas.py       Pydantic models matching api-contract.md
  app/detector.py      Detector protocol + MockDetector (the adapter)
  app/repo.py          save_batch(...) : Supabase tables + local disk
  app/config.py        reads api/.env
  tests/
  supabase/migrations/<ts>_init.sql
  requirements.txt
  .gitignore           .env, data/, .venv/, __pycache__/
  data/                runtime images (gitignored)
```

## Tasks

### T1. Scaffold + /health + CORS
- **Status: DONE 2026-11-24.** Tester PASS, reviewer PASS. Logged by scribe.
- Owner: `coder`, then tester, reviewer. Skill: `karpathy-guidelines`.
- Depends on: OPEN-6 answered (yes).
- Time: 1 h.
- Goal: runnable FastAPI app with `GET /health`, CORS for the Vite dev server, config loaded from `api/.env`.
- Files allowed to change: `api/app/main.py`, `api/app/config.py`, `api/requirements.txt`, `api/.gitignore`, `api/README.md`, `api/tests/test_health.py`.
- Notes: CORS origins from env `CORS_ORIGINS`, default `http://localhost:5173,http://127.0.0.1:5173`. No `*`. README says phone-on-LAN testing needs `http://<laptop-ip>:5173` added. `api/.gitignore` lists `.env`, `data/`, `.venv/`, `__pycache__/`. Do not touch `.env.example` except to add missing variable names (no values).
- Done-criteria:
  - `cd Tang/api && python -m pytest -q` passes (health test).
  - `uvicorn app.main:app --port 8000` then `curl -s localhost:8000/health` returns `{"status":"ok"}`.
  - `curl -s -i -X OPTIONS localhost:8000/api/counts -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST"` returns `access-control-allow-origin: http://localhost:5173`.
  - `git status` from `Tang/` shows no `.env`, `.venv/`, `__pycache__/`, `data/` as tracked or staged.

### T2. Mock detector behind the adapter (TEST-FIRST)
- **Status: DONE 2026-11-24.** Tester PASS (24 passed), reviewer PASS. Logged by scribe.
- Owner: `coder` writes tests first. Skill: `test-driven-development` (adapter = allowed test-first area).
- Depends on: T1.
- Time: 1.5 h.
- Goal: `Detector` protocol with one method (image in, `pipes` + `crop_box` out) and a deterministic `MockDetector`. Route code never knows box format.
- Files allowed to change: `api/app/detector.py`, `api/app/schemas.py` (pipe/box models only), `api/tests/test_detector.py`.
- Notes: seed = hash of image bytes (+ optional `MOCK_SEED` env), so the same photo gives the same answer on every demo run. Pipes on a jittered grid, confidence 0.55-0.99 with a few low ones. All boxes clamped inside the image. File header comment states OPEN-1 and OPEN-8. Image is decoded with Pillow, `exif_transpose` first.
- Tests written first (must fail before code exists, show the failing run):
  - same bytes + same seed gives identical output; different seed differs.
  - every box has w>0, h>0 and lies inside the image.
  - `crop_box` contains every pipe box and lies inside the image.
  - `count == len(pipes)`, count >= 1 for a normal image, 10x10 image does not crash.
  - a `FakeDetector` can be injected into the app (proves the swap point).
- Done-criteria: `python -m pytest api/tests/test_detector.py -q` all green, and the red-first run is in the coder's report.

### T3. Supabase migration `_init.sql` + manual run by Tang
- **Status: DONE 2026-11-25.** Coder wrote `api/supabase/migrations/20261124090000_init.sql`. Tester PASS (32 tests), reviewer PASS. Tang confirmed on 2026-11-25 that he ran the migration himself in the Supabase SQL editor and filled `api/.env` himself. The agents did not run the SQL and did not read `api/.env`. Dashboard column check and `select count(*)` result were not reported in this confirmation, so they are not claimed as verified here.
- Owner: `coder` writes the file. **Tang runs it** in the Supabase SQL editor. (MCP not authorized, so no agent runs it.)
- Depends on: BLOCKER-2 (Supabase project exists), OPEN-4 (id type).
- Time: 1 h (30 min file + 30 min Tang run and check).
- Goal: tables with mock fields only, nothing invented.
- Files allowed to change: `api/supabase/migrations/<timestamp>_init.sql` (timestamp format `YYYYMMDDHHMMSS`, e.g. `20261125083000_init.sql`), `api/README.md` (one "run the migration" paragraph).
- Schema (exactly this, no extra columns):
  - `batches(id uuid pk default gen_random_uuid(), created_at timestamptz not null default now(), confirmed boolean not null default false)`
  - `images(id uuid pk default gen_random_uuid(), batch_id uuid not null references batches(id) on delete cascade, filename text, count integer not null, crop_box jsonb, pipes jsonb not null default '[]', quality jsonb, original_bytes bigint, stored_bytes bigint)`
  - index on `images(batch_id)`.
  - `alter table ... enable row level security` on both, no policies (OPEN-7).
- Explicitly NOT in the file: pipe size, confirm fields (`final_count`, `added`, `removed`), DO Number, note, Actual Amount, pipe-level table, storage bucket, any ML-only field. Header comment lists them as "later demo items / OPEN".
- Notes: `filename` is stored as display data only, never used as a file path. SQL must be re-runnable safely (`create table if not exists`) or say clearly it is run once.
- Done-criteria:
  - File exists and `rg -n "pipe_size|do_number|final_count|actual" Tang/api/supabase` returns nothing.
  - Reviewer reads the SQL against this schema list: PASS only if columns match exactly.
  - Tang runs it; Supabase dashboard Table editor shows `batches` and `images` with the listed columns (screenshot from Tang, goes in the block notes).
  - Check in SQL editor: `select count(*) from batches;` returns 0 without error.
  - `api/.env` filled by Tang (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); `git status` shows `.env` not tracked. Service-role key appears nowhere in the repo: `rg -n "service_role|eyJ" Tang --glob "!*.md"` finds no key value.

### T4. Repository: persist batch + images (Supabase rows + local disk files)
- **Status: Code DONE 2026-11-25: tester PASS (86 passed), reviewer PASS (after fix loop 1). Real-DB smoke test pending Tang (agents may not read api/.env); not ticked in requirements.md until it passes.**
- Owner: `coder`, then tester, reviewer.
- Depends on: T1, T3 (tables exist), OPEN-2.
- Time: 1.5 h.
- Goal: one function/class in `repo.py`: `save_batch(images)` writes the files to `api/data/images/<batch_id>/<image_id>.<ext>` (names generated by the API, never the client's filename), inserts one `batches` row and N `images` rows, returns ids. Supabase client is created only here, using `api/.env`. Server-side only; the key never goes to the web.
- Files allowed to change: `api/app/repo.py`, `api/app/config.py`, `api/tests/test_repo.py`, `api/.gitignore`, `api/README.md`.
- Notes: tests use a fake client/in-memory stand-in so `pytest` runs without network; one separate opt-in live check (marker or script, off by default) hits the real Supabase. If the DB insert fails after files were written, delete those files and raise (no half batches). `confirmed` always inserted as `false`. If the batches insert succeeds but the images insert fails, save_batch removes the local files and makes a best-effort delete of the empty batches row (cleanup failure never masks the original error); no real transaction/RPC yet, revisit in M5.
- Done-criteria:
  - `python -m pytest api/tests/test_repo.py -q` green (rows built with the right columns, file written under `data/images/`, failure cleans up).
  - Live check (Tang's `.env`): run the manual smoke test below by hand (no opt-in script was built), then in the Supabase dashboard `batches` has 1 row and `images` has the matching rows; the image file exists under `api/data/images/`.
  - `git status` shows `api/data/` untracked-ignored.
  - `rg -n "SUPABASE_SERVICE_ROLE_KEY" Tang/api/app` shows it is only read from the environment, never a literal.
- **Manual smoke test (Tang, replaces the opt-in live-check script).** The opt-in live-check script was deliberately not built (plan says cut first). Tang runs this check by hand instead. Run from `Tang/api` in PowerShell, with a real photo at `Tang/samples/1.jpg`:
  ```
  .venv\Scripts\python.exe -c "from app import repo; from app.repo import ImageToSave; from app.schemas import Detection, Pipe; d=Detection(count=1,crop_box=(0,0,10,10),pipes=[Pipe(box=(1,1,5,5),confidence=0.9)]); r=repo.save_batch([ImageToSave('1.jpg', open('../samples/1.jpg','rb').read(), d, {'brightness':'ok','blur':'ok'})]); print(r.batch_id)"
  ```
  Then check:
  - Supabase `batches` has 1 row with `confirmed = false`.
  - Supabase `images` has 1 row with the matching `batch_id`.
  - The file exists at `api/data/images/<batch_id>/<image_id>.jpg`.
  - `git status` shows no `data/` and no `.env`.

  Clean up afterwards: delete the batch in the Supabase dashboard (`images` rows cascade), and delete the folder under `api/data/images/`.

### T5. POST /api/counts (multipart images[], 5 at once)
- **Status: Code DONE 2026-11-25: tester PASS (122 passed, incl. 25 probe tests), reviewer PASS. Real-Supabase, /docs and phone/web checks still open (listed below). Not ticked in requirements.md yet.**
- Owner: `coder`, then tester, reviewer.
- Depends on: T2, T4.
- Time: 1.5 h. Contract-shape test written first, rest alongside.
- Goal: `POST /api/counts`, multipart field `images` (repeated, per contract `images[]`). Returns `batch_id` plus one result per image: `image_id`, `count`, `crop_box`, `pipes[{box, confidence}]`, `quality`, `stored_bytes`, `original_bytes`. Results are saved through `repo.py`.
- Files allowed to change: `api/app/main.py` (or `api/app/routes_counts.py`), `api/app/schemas.py`, `api/tests/test_post_counts.py`, `api/README.md`.
- Notes: results keep the same order as the upload so the web can show per-image status. Limits per OPEN-5 (0 images -> 422, too many -> 413/422, oversize -> 413). Non-image bytes -> 415/400 naming which filename failed, nothing saved for the whole request. Pillow decode only; client filename is never a path. Placeholder `quality` per OPEN-3. Detector injected, so tests use `FakeDetector` and a fake repo. repo.save_batch does NOT validate content. It stores any bytes with an unknown extension as .bin. T5 must reject non-images (Pillow decode + load()) BEFORE calling save_batch, nothing saved for the whole request.
- Carry-over from T2 (reviewer/tester, 2026-11-24):
  - Pillow decodes lazily. On the upload path call `img.load()` or `img.verify()` so any decode error is mapped to 400/415 (not a 500).
  - Catch `Image.DecompressionBombError` explicitly. It is not an `OSError` subclass, so it would otherwise surface as a 500.
  - Enforce the upload limits: max 10 images per request, max 15 MB each. No other limit numbers apply.
  - Inject the `Detector` as a FastAPI dependency in `main.py` (swap point for the real model).
- Done-criteria:
  - `python -m pytest api/tests -q` green: 1 image, 5 images (5 results, order kept), 0 images (422), non-image (415/400), oversize (413), response keys equal the contract keys exactly, same image twice gives same count.
  - Live, with server up and real Supabase: `curl -s -F "images=@Tang/samples/1.jpg" ... (5 files) localhost:8000/api/counts` returns JSON with `batch_id` and 5 entries; each has `count`, `crop_box`, `pipes`, and `original_bytes` > 0.
  - Supabase dashboard: new `batches` row with `confirmed = false`, 5 `images` rows whose `count` equals `jsonb_array_length(pipes)`.
  - `localhost:8000/docs` field names match `docs/api-contract.md`.
  - CORS: browser call from `http://localhost:5173` to `/api/counts` is not blocked (web side checks; screenshot).
  - Plan-sheet check, with web: pick 5 photos on a phone, per-image status shows, mock API answers (this half is web work, tracked in the web plan).

**T5 done-criteria NOT yet proven (2026-11-25, open):**
- Live `curl` with 5 files against the real Supabase project (server up, Tang's `.env`).
- Dashboard rows: `batches` has the new row with `confirmed = false`; 5 `images` rows; each `count` == `jsonb_array_length(pipes)`.
- `localhost:8000/docs` field names. No `response_model` is set, so `/docs` shows an untyped 200 response, not the contract fields.
- Real-browser CORS: call from `http://localhost:5173` to `/api/counts` is not blocked (web side, screenshot).
- Phone check: pick 5 photos on a phone, per-image status shows (web work).
- Upload time of 5 phone photos on real Wi-Fi (risk list above).

**Requirements status:** demo items 1 and 2 stay unticked in `docs/requirements.md`. Item 1 needs the real-Supabase smoke test and the phone/web half. Item 2 needs the phone/web half. Both wait for those checks.

## Block schedule
| Block | Date | Tasks |
|---|---|---|
| B1 | Tue 24 Nov | T1 + T2 (Tang can create the Supabase project and fill `.env` in the gaps) |
| B2 | Wed 25 Nov | T3 (Tang runs SQL) + T4 |
| B3 | Thu 26 Nov | T5 + slip buffer |
| buffer | Fri 27 Nov | web integration fixes only; API response shape frozen after T5 |

If T3 or T4 slips (Supabase setup problems), fall back to saving rows only, no disk files, and keep `repo.py` as the single place that changes. Log the problem in `docs/problem-log.md` if anything takes over 30 min.

## Test-first summary
| Task | Test-first? |
|---|---|
| T1 | no (smoke) |
| T2 | yes (adapter) |
| T3 | no (reviewer checks SQL by eye, Tang runs it) |
| T4 | tests alongside |
| T5 | contract-shape test first |

## Cut first if time slips
1. Opt-in live check script in T4 (keep the manual dashboard check).
2. Oversize/413 tests in T5.
3. Never cut: the adapter boundary (T2), the migration with exact columns (T3), the contract keys in the response (T5).

## Risks
- Supabase project, `.env` and the migration run are on Tang. If they are not ready by Wed, T4 and T5 cannot be proven live.
- Box format and `crop_box` source are still OPEN with the ML team; only `detector.py` and `docs/api-contract.md` change when they answer.
- Placeholder `quality` and `stored_bytes == original_bytes` must not be shown in the demo as real results until items 6 and 7 are built.
- Phone photos can be 5-12 MB; 5 at once is up to about 60 MB per request. Check upload time on real Wi-Fi in T5.
- Unauthenticated API on the LAN is for the demo only. Auth = M5.

## After the coder tasks (scribe, not planner)
- `docs/decisions.md`: Supabase tables pulled forward, local disk for images, placeholder quality, uuid ids.
- `docs/api-contract.md`: record what the mock really returns, box format stays PROPOSED/OPEN.
- Tick demo item 2 in `docs/requirements.md` only after reviewer PASS.
