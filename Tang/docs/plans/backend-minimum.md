# Plan: minimum FastAPI backend for the 30 Nov demo

Date: 2026-11-24. Planner output. Status: proposed, waiting for Tang's yes on the OPEN items.

## TL;DR
- `Tang/api/` is **empty** (only README + .env.example). Everything below is built from zero. Nothing in M2/M3 exists on the API side yet.
- 6 tasks + 1 optional. Each task is 1-1.5 h, so two tasks fill one 3 h block. Four blocks: Tue 24, Wed 25, Thu 26, Fri 27. Sat/Sun 28-29 = buffer + rehearsal (M4 is Sun 29).
- Storage = local disk + SQLite (stdlib `sqlite3`) behind a small `Repository` interface. Supabase is M5 (backlog) and swaps in by adding one new class, no route changes.
- Covers demo items 2, 5, 6, 7 (API side). Item 1 and the UI parts of 3, 4 are web work, not here.
- No Supabase, no auth, no real model, no panorama, nothing from the backlog.

## Priority check
All tasks map to "Demo scope" items 2, 5, 6, 7 in `docs/requirements.md`. The optional task 7 is from the "Added by web interview" list, so it is flagged proposed and sits last.

## Blockers and OPEN items (need Tang)
| # | Item | Proposed default (used until answered) |
|---|---|---|
| OPEN-1 | Box format is OPEN in `api-contract.md` (ML team has not answered) | `[x, y, w, h]`, **pixels, in the coordinate space of the stored image**. Set in ONE place: the detector adapter. Listed as an assumption, not a fact. |
| OPEN-2 | Confirm: what if `final_count` != pipes - removed + added? | Reject with 422 and a clear message. Alternative: accept and store both. Tang decides. |
| OPEN-3 | Confirm a batch twice? | 409 Conflict. Alternative: allow overwrite. Tang decides. |
| OPEN-4 | Brightness/blur thresholds. The web does the same check client-side (tech-stack), so the two must agree | brightness: mean luma <60 = dark, >200 = bright. blur: variance of edge response below a tuned constant = blurry. Constants in one `quality.py`, tuned on 5 real phone photos in `Tang/samples/`. |
| OPEN-5 | Upload limits | max 10 images per batch, max 15 MB each, JPEG/PNG/WebP only. Tell Tang if the web needs more. |
| OPEN-6 | `removed` meaning | list of **indexes into the `pipes` array** returned by POST (contract example `[3]`). |
| OPEN-7 | Result screen needs the stored image back from the API (after reload, or from history) but the contract has no such endpoint | Proposed extra `GET /api/images/{image_id}` returning the stored JPEG. Not in the contract. Cut first if the web keeps images client-side. |
| OPEN-8 | Python version + dependency list | Python 3.11+. `fastapi`, `uvicorn`, `python-multipart`, `pillow`, `numpy`, `pytest`, `httpx` in `api/requirements.txt`. Adding these = Tang's yes on this plan. |

Deviations from `docs/tech-stack.md` (log in `decisions.md` via scribe):
- Mock detector = seeded generator, **not** OpenCV HoughCircles (tech-stack idea). Reason: deterministic, no OpenCV install on Tang's laptop, repeatable demo. HoughCircles can come later as a second adapter.
- Server compression = JPEG re-encode (Pillow), **not** WebP. Reason: user decision, simpler. WebP/SSIM/PSNR = M5 backlog.
- Storage = SQLite + disk, **not** Supabase. Reason: Supabase is M5.
- No `api/supabase/migrations/` file is created now. SQLite schema lives in `repo_sqlite.py`.

## Assumptions (list kept in code comments + README too)
1. Coordinates: pixels of the stored image. v1 compression does **not** resize, so stored and original pixel space are the same. If resize is added later, boxes must be scaled.
2. `exif_transpose` is applied before everything, so phone photos are upright and boxes match what the user sees.
3. `original_bytes` = bytes the API received. The web may already compress client-side, so the ratio shown can look small. Say so in the demo.
4. If JPEG re-encode makes a file bigger than the original, report the real numbers (stored_bytes > original_bytes). Never hide it.
5. `crop_box` is computed from the pipe boxes (bounding box + padding, clamped to the image). Because crop_box is OPEN, it is computed inside the adapter, so the real model can provide its own.
6. `confirmed` in history = batch has been confirmed. `total_count` = sum of `final_count` if confirmed, else sum of model counts.
7. `date` = ISO 8601 UTC string.
8. Mock detector seed = hash of image bytes, plus an optional `MOCK_SEED` env var. Same image = same result every run. This makes demo rehearsal repeatable.

## Target layout (all inside `Tang/api/`)
```
api/
  app/main.py        FastAPI app, CORS, router wiring
  app/schemas.py     Pydantic models (request/response)
  app/detector.py    Detector protocol + MockDetector (the adapter)
  app/quality.py     brightness + blur check
  app/compress.py    JPEG re-encode, byte report
  app/repo.py        Repository protocol (interface only)
  app/repo_sqlite.py SQLite + disk implementation
  tests/             pytest
  requirements.txt
  .gitignore         data/, .venv/, __pycache__/
  data/              runtime: images + sqlite file (gitignored)
```
`api/README.md` currently says `repo.py` = Supabase access. Task 1 updates that line: `repo.py` = interface, `repo_sqlite.py` = demo impl, Supabase impl = M5.

## Block schedule
| Block | Date | Tasks | Notes |
|---|---|---|---|
| B1 | Tue 24 Nov | T1 + T2 | scaffold, then adapter test-first |
| B2 | Wed 25 Nov | T3 + T4 | quality + compression, then POST /api/counts |
| B3 | Thu 26 Nov | T5 + T6 | confirm + history, then demo hardening |
| B4 | Fri 27 Nov | T7 (optional) + web integration fixes + slip buffer | web needs the API stable by now |
| buffer | Sat/Sun 28-29 | rehearsal (M4) | no new API work |

## Tasks

### T1. Scaffold, CORS, repository interface, SQLite repo
- Owner: `coder` (then tester, reviewer).
- Depends on: OPEN-8 answered (yes to dependency list).
- Time: 1.5 h. Not test-first (scaffold), but smoke test required.
- Goal: runnable FastAPI app with `/health`, CORS for the Vite dev server, a `Repository` interface, and a SQLite+disk implementation that can save and read batches, images, and pipes.
- Files allowed to change: `api/app/main.py`, `api/app/schemas.py`, `api/app/repo.py`, `api/app/repo_sqlite.py`, `api/requirements.txt`, `api/.gitignore`, `api/README.md`, `api/tests/test_health.py`, `api/tests/test_repo.py`.
- Notes:
  - CORS origins from env `CORS_ORIGINS`, default `http://localhost:5173,http://127.0.0.1:5173`. Document that testing from a phone on the LAN needs the laptop's `http://<ip>:5173` added. No `*` with credentials.
  - Interface methods (small on purpose): `save_batch(batch)`, `get_batch(batch_id)`, `save_confirmation(batch_id, items)`, `list_batches(limit)`, `get_image_path(image_id)`.
  - Tables mirror tech-stack section 3 (`batches`, `images`, `pipes`): corrections kept with `source` / `removed`, never overwritten.
  - `api/.env.example` is not touched (Supabase keys stay for M5).
- Done-criteria:
  - `cd Tang/api && python -m pytest -q` passes (health + repo round trip: save a batch, read it back, list it).
  - `uvicorn app.main:app --port 8000` then `curl -s localhost:8000/health` returns `{"status":"ok"}`.
  - `curl -s -i -X OPTIONS localhost:8000/api/counts -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST"` returns `access-control-allow-origin: http://localhost:5173`.
  - `git status` shows no `data/`, `.venv/`, `__pycache__/` staged.

### T2. Detector adapter + seeded mock (TEST-FIRST)
- Owner: `coder` writes tests first, then code. Skill: `test-driven-development`.
- Depends on: T1.
- Time: 1.5 h.
- Goal: `Detector` protocol with one method, e.g. `detect(image: PIL.Image) -> DetectionResult(pipes, crop_box)`, and a `MockDetector` that is deterministic and seedable. The route layer never knows the box format; only this file does.
- Files allowed to change: `api/app/detector.py`, `api/tests/test_detector.py`, `api/app/schemas.py` (only the pipe/box models).
- Notes: mock lays pipes on a jittered hex-ish grid inside a stack region of the image, confidences 0.55-0.99 with a few low ones (so the web's "review this pipe" highlight can be demoed). All boxes clamped inside the image. Top-of-file comment states OPEN-1 and the proposed format.
- Tests written first (they must fail before code exists):
  - same image + same seed -> identical output; different seed -> different output.
  - every box has w>0, h>0, and lies inside the image.
  - `crop_box` contains every pipe box and lies inside the image.
  - `count == len(pipes)` and count >= 1 for a normal image; tiny image (e.g. 10x10) does not crash.
  - an alternative `FakeDetector` can be passed to the app factory (proves the swap point).
- Done-criteria: `python -m pytest api/tests/test_detector.py -q` all green, and the failing-first run was shown in the coder's report.

### T3. Quality check + compression v1 (TEST-FIRST)
- Owner: `coder`, tests first.
- Depends on: T1 (T2 not needed, can run in parallel).
- Time: 1.5 h.
- Goal: two pure functions, no HTTP yet.
  - `check_quality(image) -> {"brightness": "ok|dark|bright", "blur": "ok|blurry"}`
  - `compress_jpeg(raw_bytes) -> (stored_bytes_blob, original_bytes, stored_bytes)` JPEG quality 80 (proposed constant), `exif_transpose` first, convert RGBA/P to RGB, no resize.
- Files allowed to change: `api/app/quality.py`, `api/app/compress.py`, `api/tests/test_quality.py`, `api/tests/test_compress.py`.
- Notes: blur = variance of a Pillow edge/Laplacian-style kernel on a downscaled grayscale copy, via numpy. No OpenCV dependency. Thresholds are named constants (OPEN-4).
- Tests written first: generated images only (no photos in git).
  - solid dark image -> `dark`; solid white -> `bright`; mid-gray noise -> `ok`.
  - sharp checkerboard -> blur `ok`; Gaussian-blurred copy -> `blurry`.
  - compress: a large noisy image gives `stored_bytes < original_bytes`; reported numbers equal the real lengths; output decodes with the same width/height; a PNG with alpha does not crash; an EXIF-rotated image comes out upright; a non-image byte string raises a clear error (route maps it to 400/415 in T4).
- Done-criteria: `python -m pytest api/tests/test_quality.py api/tests/test_compress.py -q` green. Tang also runs the check on 5 real phone photos from `Tang/samples/` and records the numbers (stored/original, quality labels) in his block notes, for demo item 7.

### T4. POST /api/counts (wire detector + quality + compression + repo)
- Owner: `coder`.
- Depends on: T1, T2, T3.
- Time: 1.5 h. Integration tests written alongside, contract shape test first.
- Goal: multipart `images[]` -> response matching `api-contract.md`: `batch_id`, and per image `image_id`, `count`, `crop_box`, `pipes[{box,confidence}]`, `quality{brightness,blur}`, `stored_bytes`, `original_bytes`. Stored image + rows saved via the repository. Batch starts as unconfirmed.
- Files allowed to change: `api/app/main.py` (or `api/app/routes_counts.py`), `api/app/schemas.py`, `api/tests/test_post_counts.py`, optionally the proposed `GET /api/images/{image_id}` (OPEN-7).
- Notes: ids like `b_<8 hex>` / `img_<n>`. One bad file does not silently disappear: whole request returns 400/415 with which filename failed (simplest for v1; per-image error objects are a backlog idea). Enforce OPEN-5 limits (413 / 422). Input images never executed or trusted: Pillow decode only, filename never used as a path.
- Done-criteria:
  - `python -m pytest api/tests/test_post_counts.py -q` green: 1 image, 3 images, 0 images (422), non-image (415/400), oversize (413), response keys match the contract exactly, same image twice -> same count (seeded).
  - Live: `curl -s -F "images=@Tang/samples/a.jpg" -F "images=@Tang/samples/b.jpg" localhost:8000/api/counts` returns JSON with 2 entries, `stored_bytes` and `original_bytes` > 0.
  - Open `localhost:8000/docs`: schema shows the same field names as `docs/api-contract.md`.
  - The multipart field name is `images` (repeated), per the contract's `images[]`. Check with the web side that the form key matches.

### T5. Confirm + history (TEST-FIRST for the count logic)
- Owner: `coder`, tests first.
- Depends on: T4.
- Time: 1.5 h.
- Goal:
  - `POST /api/counts/{batch_id}/confirm` with `{images:[{image_id, final_count, added, removed}]}`: validate, store corrections (`removed` pipes flagged, `added` pipes saved with `source = user_added`, never delete model rows), mark batch confirmed.
  - `GET /api/counts?limit=20` returns newest first: `batch_id`, `date`, `total_count`, `confirmed`.
- Files allowed to change: `api/app/main.py` (or routes file), `api/app/schemas.py`, `api/app/repo_sqlite.py`, `api/tests/test_confirm.py`, `api/tests/test_history.py`.
- Rules to encode (depends on OPEN-2, OPEN-3, OPEN-6):
  - consistency: `final_count == len(model pipes) - len(set(removed)) + len(added)`, else 422 (default).
  - `removed` index out of range -> 422; unknown `batch_id` or `image_id` -> 404; image missing from the body -> 422 (every image must be confirmed).
  - second confirm -> 409 (default).
  - history `total_count` per assumption 6; `limit` clamped to 1..100, default 20.
- Tests written first: add 2 / remove 1 gives the right final; inconsistent final_count -> 422; double confirm -> 409; history order, `confirmed` flips after confirm, total uses final counts; `limit=1` returns 1 row; empty DB returns `[]`.
- Done-criteria:
  - `python -m pytest api/tests -q` all green (whole suite).
  - Live chain: POST counts -> take `batch_id` -> `curl -s -X POST localhost:8000/api/counts/<id>/confirm -H "Content-Type: application/json" -d '{...}'` returns 200 -> `curl -s "localhost:8000/api/counts?limit=20"` shows that batch with `confirmed: true` and the final total.
  - Restart uvicorn, history still shows the batch (persistence proof).

### T6. Demo hardening + docs
- Owner: `coder` (code/README), `scribe` afterwards (contract, decisions, requirement ticks).
- Depends on: T5.
- Time: 1 h.
- Goal: Tang can start the API from a cold laptop in under 2 minutes, reach it from a phone, and recover from a bad state.
- Files allowed to change: `api/README.md` (run steps, env vars, assumptions, how to wipe `data/`), `api/scripts/smoke.ps1` or `api/scripts/smoke.sh` (the T5 curl chain as a script), `api/app/main.py` (startup log of data dir + CORS origins only).
- Notes: run on `--host 0.0.0.0` for phone testing; note Windows firewall prompt. State clearly that an unauthenticated API on the LAN is for the demo only (auth = M5).
- Done-criteria:
  - Fresh clone steps in README work: `python -m venv .venv`, install, `pytest -q` passes, `uvicorn` starts.
  - `api/scripts/smoke.*` prints PASS for upload -> confirm -> history against a running server.
  - Phone browser opens `http://<laptop-ip>:8000/health` and sees ok (screenshot, Tang).
  - Scribe updates: `docs/api-contract.md` (what the mock really returns, box format = PROPOSED default, still OPEN with ML team), `docs/decisions.md` (deviations listed above), tick demo items 2/5/6/7 only if reviewer PASS.

### T7 (OPTIONAL, last). DO Number / pipe size / note / Actual Amount
- Status: **PROPOSED, UNCONFIRMED.** Decisions log says the DO format (2 letters + 8 digits) is agreed, "pipe size per stack" is "assumed, confirm", and the mismatch rule is "proposed, confirm with Tang". The pipe size list is OPEN (ask company via Hymn). Do not start without Tang's yes.
- Owner: `coder`. Depends on: T5. Time: 1.5 h. Only if B1-B3 are done and the web needs it.
- Goal: accept and store `do_number` (batch), `pipe_size`, `note`, `actual_amount` (per image) on confirm, and return them in history rows. Mismatch rule (typed Actual != confirmed count -> note required, both saved) enforced server-side only if Tang confirms it.
- Files allowed to change: `api/app/schemas.py`, `api/app/repo.py`, `api/app/repo_sqlite.py`, `api/app/main.py`, `api/tests/test_confirm_fields.py`, `api/README.md`.
- OPEN questions: Is `do_number` sent on POST or on confirm? Is `pipe_size` a free string or an enum (list unknown)? Is the mismatch check API-side or UI-only? Contract does not include any of these fields, so they are optional and additive: old requests still pass.
- Done-criteria: `python -m pytest api/tests -q` green including: valid DO `DX26030043` accepted, `DX2603004` rejected 422, mismatch without note -> 422 (only if rule confirmed), requests without the new fields still pass.

## Test-first summary
| Task | Test-first? |
|---|---|
| T1 scaffold | no (smoke tests) |
| T2 detector adapter | **yes** |
| T3 quality + compression | **yes** (compression), quality tests alongside |
| T4 POST /api/counts | contract-shape test first, rest alongside |
| T5 confirm + history | **yes** (count logic) |
| T6 hardening | no |
| T7 optional fields | tests alongside |

## Cut first if time slips (in this order)
1. T7 optional fields (whole task).
2. `GET /api/images/{image_id}` (OPEN-7).
3. Per-file error detail in upload failures, and the 413 size-limit tests.
4. `api/scripts/smoke.*` (keep the README curl lines instead).
5. History `limit` clamping tests.
6. Never cut: T2 adapter boundary, original vs stored bytes in the response (demo item 7), quality flags (demo item 6), confirm + history (demo item 5).

If B1 or B2 overruns, shift T6 into B4 and keep the Sat/Sun buffer for rehearsal only.

## Risks
- Web needs a stable response shape from the end of B2 (after T4). Tell the web side the shape is frozen after T4, and that box format is a PROPOSED default.
- Phone photos can be 5-12 MB; check the 15 MB limit and upload time on real Wi-Fi in T3's real-photo run.
- Quality thresholds chosen on 5 photos may misfire on warehouse lighting. They only warn, never block (decision 2026-11-03).
- ML team may answer the OPEN box format after the demo; only `detector.py` changes (and `docs/api-contract.md`).
