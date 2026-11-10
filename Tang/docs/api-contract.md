# API contract: count result (owners: ML = Game/Opor, backend = Hymn, web = Tang)

Status: **DRAFT, proposed by Tang. Not confirmed by the ML team.**
The web app only reads model output through `web/src/lib/detection.ts` (adapter). If the real format differs, change the adapter only.

## POST /api/counts (multipart: images[])
Response (proposed):
```json
{
  "batch_id": "b_123",
  "images": [
    {
      "image_id": "img_1",
      "count": 42,
      "crop_box": [x, y, w, h],
      "pipes": [{ "box": [x, y, w, h], "confidence": 0.93 }],
      "quality": { "brightness": "ok|dark|bright", "blur": "ok|blurry" },
      "stored_bytes": 210345,
      "original_bytes": 3120000
    }
  ]
}
```

## Implemented (mock detector), 2026-11-04
**Demo storage (2026-11-10):** with `DEMO_MEMORY=true` and no Supabase keys, the API keeps everything in one in-memory repo (single worker, lost on restart) instead of returning 503. `GET /health` returns `{"status":"ok","storage":"supabase"|"memory"|"none"}`.

Storage = Supabase through `api/app/repo.py`. If `SUPABASE_URL` / `SUPABASE_SECRET_KEY` are missing or a placeholder, every endpoint below returns **503** `{"detail": "database not configured: ..."}` (`/health` still works). DB errors also return 503 `{"detail": "database error: <reason>"}`.

### POST /api/counts (multipart)
Form fields: `images[]` (1-10 files, 15 MB each), `operator_id` (optional, max 64 chars, default `"unknown"`).
Response shape as above, except: `batch_id` is the DB uuid of the saved **draft** batch; `image_id` stays `img_<n>` (upload order, stored as `images.position`). Failed images are saved too (`error` set, `model_count` 0). No `stored_bytes` yet.
**Pipe index** = the 0-based position of a pipe in `images[i].pipes[]` (no extra field). It is stable: stored as `pipes.position` (migration `20261109_pipes_position.sql`, not applied yet) and used by `corrections[].removed` in confirm.

### POST /api/counts/{batch_id}/confirm
Body (JSON):
```json
{
  "do_number": "DX26030043", "actual_amount": 41, "notes": "2 hidden at the back", "image_ids": ["img_1", "img_3"],
  "corrections": [{ "image_id": "img_1", "added": [[120, 340, 48, 47]], "removed": [0, 5] }]
}
```
- `image_ids` (optional): the photos the operator kept, using the `img_<n>` ids from the upload response; omitted = keep all. Photos not listed are marked `images.excluded = true` (migration `20261104_images_excluded.sql`, not applied yet) and `model_total` is recomputed from the kept photos only. 422 if the list is empty or has an unknown id. `image_count` in records still counts all uploaded photos.
- `do_number`: required, trimmed, 1-64 chars (format OPEN, any text). `notes`: required, trimmed, 1-2000 chars. `actual_amount`: integer >= 0.
- 200 -> one **record** (shape below), status `confirmed`. 404 unknown batch (also a non-uuid id), 409 already confirmed, 422 empty DO/notes or negative amount.
- `corrections` (optional, max 10 entries, one per photo): per-box edits from the Result page, saved as training data. Omitted or `[]` = nothing changes.
  - `image_id`: an `img_<n>` id of a **kept** photo. `added` and `removed` both default to `[]`.
  - `removed`: pipe indexes (0-based, see upload response) -> that pipe row gets `removed = true`. Max 1000, no duplicates, each < that photo's `count`.
  - `added`: boxes `[x, y, w, h]` (same format as model boxes, format OPEN; numbers may be decimals, must be finite, `w`/`h` > 0). Each -> new pipe row `source = "user_added"`, `confidence = null` (the operator is not a model score), `removed = false`, `position = null`. Max 500 per photo.
  - 422 if: unknown or not-kept `image_id`, duplicate `image_id` entries, index out of range or duplicated, box not 4 finite numbers or `w`/`h` <= 0, over the size limits. Everything is checked before anything is written.
  - Corrections do **not** change `actual_amount` (what the operator typed) or `model_total` (model count of kept photos).
  - Real-model adapter rule: `count` must equal `len(pipes)` (the removed-index range check uses `images.model_count`).

### GET /api/counts?status=&q=&limit=&offset=
- `status`: `draft` | `confirmed` | `flagged` (confirmed and actual != model), omit for all.
- `q`: matches DO number or operator id, case-insensitive substring; only letters, digits, space and `-` are used (other characters are dropped). Max 64.
- `limit` 1-100 (default 20), `offset` >= 0 (default 0). Newest first.
Response: `{ "items": [record], "total": 57 }` (`total` = all rows matching the filter, before paging).

Record:
```json
{
  "batch_id": "uuid", "created_at": "2026-11-04T03:12:00Z", "operator_id": "OP-7",
  "do_number": "DX26030043", "image_count": 3, "model_total": 42, "actual_amount": 41,
  "variance": -1, "status": "confirmed", "flagged": true,
  "notes": "2 hidden at the back", "confirmed_at": "2026-11-04T03:15:00Z"
}
```
`variance` = actual_amount - model_total, `null` while draft. Draft rows have `do_number`, `actual_amount`, `notes`, `confirmed_at` = `null`.

### GET /api/stats
```json
{ "detections_today": 12, "confirmed_total": 40, "correction_rate": 0.25, "failed_images_today": 1 }
```
- "today" = the calendar day in Asia/Bangkok (server side).
- `detections_today`: batches created today (any status). `confirmed_total`: all confirmed batches.
- `correction_rate`: share (0-1) of confirmed batches where actual != model; `null` when nothing is confirmed.
- `failed_images_today`: photos uploaded today with an `error`.
- No accuracy number until there is ground truth (OPEN, see plan app-flow).

### GET /api/stats/daily?days=7
Dashboard charts. `days` 1-31 (default 7), else 422. Same 503 as other endpoints when the DB is not configured / errors.
```json
{ "days": [ { "date": "2026-11-03", "detections": 5, "pipes_actual": 412, "confirmed": 4, "corrected": 1, "correction_rate": 0.25 } ] }
```
- Exactly `days` entries, oldest first, last one = today, zero-filled. `date` = Asia/Bangkok calendar day (same rule as `/api/stats`).
- `detections`: batches created that day (any status, drafts included).
- `pipes_actual`, `confirmed`, `corrected`: by `confirmed_at` day: sum of `actual_amount`, number confirmed, number confirmed with actual != model.
- `correction_rate`: corrected / confirmed (rounded to 4 places), `null` when confirmed = 0.
- Model vs actual chart: no extra endpoint, use `GET /api/counts?status=confirmed&limit=10`.

### Proposed earlier (replaced by the sections above)
- confirm body `{ "images": [{ "image_id", "final_count", "added", "removed" }] }` -> replaced by `corrections` above (no `final_count`: `actual_amount` is the operator's number).
- `GET /api/counts?limit=20` history list -> implemented above.

## Field status
| Field | Status | Question for ML team |
|---|---|---|
| box format | OPEN | pixels or normalized 0-1? [x,y,w,h] or [x1,y1,x2,y2]? |
| confidence | OPEN | 0-1? which threshold counts as a pipe? |
| crop_box | OPEN | does the model give it, or do we compute it from pipe boxes? |
| circles vs boxes | OPEN | OpenCV HoughCircles gives (cx, cy, r), YOLO gives boxes. Which one? |
| speed | OPEN | seconds per image on the server? |
| method | OPEN | OpenCV or YOLO, decided by ML team |

Low-confidence threshold for "review this pipe" highlight: **OPEN** (record the agreed number here).

Client-side quality thresholds (`web/src/lib/quality.ts`): **OPEN**, tune on real yard photos. Measured on a copy downscaled to 512px long side: `DARK_LUMA = 60` (mean Rec.601 luma below = dark), `BRIGHT_LUMA = 200` (above = bright), `BLUR_VARIANCE = 100` (3x3 Laplacian variance below = blurry). Upload compression (`web/src/lib/compress.ts`): long side 2048px, JPEG quality 0.8. If re-encoding is not smaller, the original file is uploaded as-is (may exceed 2048 px).

## Before using real Supabase
Apply `api/supabase/migrations/20261104_images_excluded.sql` and `20261109_pipes_position.sql` (both **NOT APPLIED YET**). Without them, confirm with `image_ids` and every upload fail.
