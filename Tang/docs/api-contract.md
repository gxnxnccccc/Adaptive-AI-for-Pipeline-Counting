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
Storage = Supabase through `api/app/repo.py`. If `SUPABASE_URL` / `SUPABASE_SECRET_KEY` are missing or a placeholder, every endpoint below returns **503** `{"detail": "database not configured: ..."}` (`/health` still works). DB errors also return 503 `{"detail": "database error: <reason>"}`.

### POST /api/counts (multipart)
Form fields: `images[]` (1-10 files, 15 MB each), `operator_id` (optional, max 64 chars, default `"unknown"`).
Response shape as above, except: `batch_id` is the DB uuid of the saved **draft** batch; `image_id` stays `img_<n>` (upload order, stored as `images.position`). Failed images are saved too (`error` set, `model_count` 0). No `stored_bytes` yet.

### POST /api/counts/{batch_id}/confirm
Body (JSON):
```json
{ "do_number": "DX26030043", "actual_amount": 41, "notes": "2 hidden at the back", "image_ids": ["img_1", "img_3"] }
```
- `image_ids` (optional): the photos the operator kept, using the `img_<n>` ids from the upload response; omitted = keep all. Photos not listed are marked `images.excluded = true` (migration `20261104_images_excluded.sql`, not applied yet) and `model_total` is recomputed from the kept photos only. 422 if the list is empty or has an unknown id. `image_count` in records still counts all uploaded photos.
- `do_number`: required, trimmed, 1-64 chars (format OPEN, any text). `notes`: required, trimmed, 1-2000 chars. `actual_amount`: integer >= 0.
- 200 -> one **record** (shape below), status `confirmed`. 404 unknown batch (also a non-uuid id), 409 already confirmed, 422 empty DO/notes or negative amount.
- Per-pipe corrections (`added`/`removed` boxes) are not in this body yet; `actual_amount` carries the correction for now.

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

### Proposed earlier (replaced by the sections above)
- confirm body `{ "images": [{ "image_id", "final_count", "added", "removed" }] }` -> per-pipe corrections, later.
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
