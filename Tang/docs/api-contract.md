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

### What the API really returns (implementation, 2026-11-25)
- `batch_id` and `image_id` are real **uuid strings** (for example `3f2c...`). `b_123` and `img_1` above are examples only.
- Status codes: 422 = no images or missing `images` field; 413 = more than 10 images, or a file over 15 MB; 415 = not a decodable image; 500 = save failure, returned with no exception text.
- Error messages are in Thai and name the image by 1-based position, never by filename. Nothing is saved when any image fails.
- `quality` = `{"brightness":"ok","blur":"ok"}` is a fixed placeholder, not a measurement (OPEN-3).
- `stored_bytes` == `original_bytes` until compression is built (OPEN-3).
- Box format, `crop_box` source, confidence scale/threshold and all other rows in the Field status table stay **OPEN**. Nothing in the table is confirmed by the ML team.

## POST /api/counts/{batch_id}/confirm
Body: `{ "images": [{ "image_id": "img_1", "final_count": 41, "added": [[x,y,w,h]], "removed": [3] }] }`

## GET /api/counts?limit=20
History list: batch_id, date, total_count, confirmed (bool).

## Field status
| Field | Status | Question for ML team |
|---|---|---|
| box format | OPEN | pixels or normalized 0-1? [x,y,w,h] or [x1,y1,x2,y2]? |
| confidence | OPEN | 0-1? which threshold counts as a pipe? |
| crop_box | OPEN | does the model give it, or do we compute it from pipe boxes? |
| circles vs boxes | OPEN | OpenCV HoughCircles gives (cx, cy, r), YOLO gives boxes. Which one? |
| speed | OPEN | seconds per image on the server? |
| method | OPEN | OpenCV or YOLO, decided by ML team |
| pipe size | OPEN | does the model detect pipe size/type? (Figma Make prototype mock simulated 5 sizes) -> Game/Opor |
| pipe size list | OPEN | which sizes/types exist? -> ask the company via Hymn |

Low-confidence threshold for "review this pipe" highlight: **OPEN** (record the agreed number here).
