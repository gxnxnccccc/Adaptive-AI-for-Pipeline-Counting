# Plan: multi-upload

Goal: pick several photos, upload each to the mock API, see per-image status plus count, boxes and crop box per image. | Requirement: Demo items 1 and 2 (P3). Item 5 (store + history) is the next plan, not this one.

Inputs read: `CLAUDE.md`, `docs/design/capture-upload.md`, `docs/requirements.md`, `docs/api-contract.md` (DRAFT), `docs/tech-stack.md`, `docs/decisions.md`. `web/` and `api/` are empty, so this is a greenfield scaffold. M1 is 8 Nov.

## Tasks
1. [ ] **DB schema as a migration (file only, not applied yet).** Tables `batches`, `images`, `pipes` per `tech-stack.md` section 3, RLS on, private bucket `pipe-images`. | files: `api/supabase/migrations/<timestamp>_init.sql` | done when: file exists, SQL parses (`psql --set ON_ERROR_STOP` dry run, or review by `reviewer`), and Tang approves before it is applied to project `cxgurtdgtrldhtawkrrr`.
2. [ ] **API scaffold.** FastAPI app, `GET /health`, CORS for the Vite dev origin, settings read from `api/.env`, `requirements.txt`, pytest + TestClient. | files: `api/app/main.py`, `api/app/config.py`, `api/requirements.txt`, `api/tests/test_health.py` | done when: `pytest` passes and `GET /health` returns 200 at `localhost:8000`; `/docs` loads.
3. [ ] **Detector adapter + mock (test first).** `detect(image_bytes) -> {count, crop_box, pipes[{box, confidence}]}` behind one function. Mock = OpenCV `HoughCircles` converted to boxes; `crop_box` computed from the union of pipe boxes (this is the OPEN crop_box question, kept inside the adapter). | files: `api/app/detector.py`, `api/tests/test_detector.py` | done when: pytest passes on a synthetic image of N drawn circles (count within +-1 of N) and on a blank image (count 0, `crop_box` null, no crash).
4. [ ] **`POST /api/counts`.** Multipart `images[]`, runs the adapter per image, returns the draft contract shape (`batch_id`, per-image `image_id`, `count`, `crop_box`, `pipes`). A bad or non-image file fails only that image, with an error field. No Supabase writes yet. | files: `api/app/routes/counts.py`, `api/app/schemas.py`, `api/tests/test_counts.py` | done when: pytest posting 3 files (2 valid, 1 text file) gets 3 entries, 2 with counts and 1 with an error; `curl` against the running server shows the same.
5. [ ] **Web scaffold.** Vite + React + TS + Tailwind, shadcn button/card, `VITE_API_URL` env, `src/lib/detection.ts` adapter (the only code that reads the API response), types from `/openapi.json` via `openapi-typescript`. | files: `web/` (config, `src/main.tsx`, `src/lib/detection.ts`, `src/lib/api.ts`, `web/.env.example`) | done when: `npm run dev` serves a page, `npx tsc --noEmit` passes, and a Vitest test of `detection.ts` maps a sample API response to the app type.
6. [ ] **Capture/Upload screen with per-image status.** Build from `docs/design/capture-upload.md`: `StepCard`, `DropZone` (multiple, real drag and drop, `sr-only` input), thumbnail list with status (queued / uploading / done / failed), per-image remove, add-more, "Capture from Camera" via `<input capture>`. Remove removes one image, not the whole workflow. | files: `web/src/components/{StepCard,DropZone,ImageList}.tsx`, `web/src/pages/Capture.tsx`, `web/src/components/*.test.tsx` | done when: Vitest + RTL: dropping 5 files shows 5 rows; a mocked failed upload shows a failed row and the others still finish; removing one row leaves 4. Manual: with the API running, 5 real photos from `Tang/samples/` show 5 counts.

Order: 1 can run any time; 2 -> 3 -> 4 -> 5 -> 6. One coder run per task, tester + reviewer after each.

## OPEN
- `box` format, confidence scale and threshold, circles vs boxes, `crop_box` source, speed, method (see `docs/api-contract.md`) -> ask Game/Opor. Mock output uses `[x, y, w, h]` in pixels; only `detector.py` and `detection.ts` change when the answer arrives.
- Who owns the Supabase project, Tang or Hymn -> ask Hymn (blocks applying task 1, not writing it).
- Max files per batch and max file size -> pick a default with Tang (suggest 10 files, 15 MB each), record in `decisions.md`.
- Does the Figma design get a multi-image variant first? -> ask Tang. This plan assumes no and follows the MISSING list in the spec.

## Risks
- The Supabase secret key is still a placeholder in `api/.env`. Not needed until the store step (item 5), so this plan does not touch it.
- `HoughCircles` accuracy on real stacks is poor and needs tuning. It is a mock; do not tune beyond "returns something plausible", the ML team replaces it.
- Large phone photos (10 MB+) upload slowly. Client compression (item 7) is a later plan; the 15 MB cap protects the mock meanwhile.
- Six tasks across two stacks in 4 days to M1 is tight. If it slips, cut task 6 to a simple list without drag and drop and log the cut.
