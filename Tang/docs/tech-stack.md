# Tech stack (Tang: web + API)

Status: **agreed by Tang 3 Nov**: Figma (design), Vite + React + TS (web), FastAPI (API), Supabase (DB + image storage).
Rule of thumb: boring, free, well-documented tools. The innovation goes in the counting flow, not the stack.

## 1. Architecture
```
[Figma] --design--> [Web app (Tang)]   [RN app (Guy)]
                           \               /
                REST + JSON (HTTPS), types generated from OpenAPI
                                  |
                          [FastAPI (Tang)] --> detector adapter --> mock now / ML model later
                                  |  (service key, server only)
                    ┌─────────────┴──────────────┐
           [Supabase Postgres]           [Supabase Storage]
     batches, images, pipes, corrections   compressed images (private bucket)
```
Apps never talk to Supabase directly for writes. Everything goes through FastAPI, so the API is the single source of truth for both web and RN.

## 2. Picks per layer
| Layer | Pick | Why | Alternative |
|---|---|---|---|
| UI design | **Figma** | wireframes -> hi-fi -> clickable prototype; team + professor can comment; specs for the coder | pen + paper |
| Web | Vite + React + TypeScript + Tailwind | fast setup, phone-browser friendly, same React mindset as Guy's RN | Next.js |
| Web state/data | TanStack Query | upload status, retries, caching | fetch + useState |
| Camera/upload | `<input type="file" accept="image/*" capture multiple>` | every phone browser, multi-image (P3) | `getUserMedia` (later, live guidance P1) |
| Client compression | canvas -> WebP/JPEG resize before upload | smaller uploads on factory Wi-Fi (P5) | browser-image-compression |
| Pre-capture guidance v1 | brightness (mean pixel) + blur (edge variance) on a small canvas copy | no ML needed | OpenCV.js |
| API | FastAPI + Pydantic | same language as the model team, auto docs at `/docs` | Node |
| DB + storage | **Supabase** (Postgres + Storage), `supabase-py` from FastAPI | one service, real SQL for the report, dashboard to show the professor, MCP connector for Claude Code | Firebase |
| Shared types | `openapi-typescript` from FastAPI's `/openapi.json` | web + RN can't drift from the API | hand-written |
| Mock detector | OpenCV `HoughCircles` in `api/app/detector.py` | real-ish circles from real photos = a working baseline; ML model replaces it later | random fake data |
| Server compression | Pillow -> WebP (or AVIF), tuned quality | P5, measurable | JPEG re-encode |
| Quality proof (P5) | SSIM + PSNR (scikit-image), original vs compressed | numbers for the report | visual check |
| Tests | Vitest + RTL (web), pytest + TestClient (API) | standard | Jest |

## 3. Supabase setup (draft, apply via migration in week 2-3)
Tables:
| Table | Key columns |
|---|---|
| `batches` | id, created_at, created_by, status (`draft`/`confirmed`), total_count |
| `images` | id, batch_id, storage_path, original_bytes, stored_bytes, width, height, crop_box, quality_flags, model_count |
| `pipes` | id, image_id, box, confidence, source (`model`/`user_added`), removed (bool) |

`final_count` per image = pipes where removed = false. User corrections are kept (source/removed), never overwritten, so they double as training data (P6 idea).

Storage: private bucket `pipe-images`, path `batches/<batch_id>/<image_id>.webp`. The web app shows images via short-lived signed URLs from the API.

Rules:
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` live only in `api/.env` (gitignored). The service-role key never goes into `web/`, Figma, docs or chat.
- Turn on Row Level Security on every table even though only the API writes (defence if a key leaks later).
- Schema changes = SQL migration files in `api/supabase/migrations/`, never click-edits in the dashboard without a migration.
- Free projects can pause after inactivity and have size limits. Check the current limits on Supabase's pricing page, and open the dashboard before any demo.
- Who owns the Supabase project (Tang or Hymn as backend head)? **OPEN**, confirm with Hymn.

## 4. Figma setup
- One team file "SPDS", pages: `01 Wireframes`, `02 UI`, `03 Prototype`, `04 Handoff`.
- Demo screens (M1, 8 Nov): Capture/Upload (multi) -> Upload status -> Result (crop + boxes + count) -> Correct (tap +/-) -> Confirm -> History.
- Use Auto Layout + a tiny style set (colors, text sizes, 44-48px touch targets) so it maps 1:1 to Tailwind.
- Share the frame link with Guy so the RN app looks the same.
- Handoff to Claude Code: the `designer` agent turns a frame (Figma link via the Figma MCP server if you've connected it, otherwise an exported PNG in `docs/design/img/`) into `docs/design/<screen>.md`.

## 5. Hosting (demo / team testing, decide in week 4)
| Part | Option |
|---|---|
| Web | Netlify or Vercel (free, deploy from GitHub) |
| API | Render / Railway / Fly.io, or laptop + tunnel for the 30 Nov self demo |
| DB/storage | Supabase (cloud already) |

## 6. Idea bank for the professor's "study case" (P6), pick max 1
- **Human-in-the-loop learning** (recommended): every correction stored in `pipes` = labelled data for the ML team. Fits "Adaptive AI".
- **Two-stage counting**: crop the stack first (P4), count only inside the crop.
- **Panorama/stitching** (OpenCV Stitcher), only if the professor confirms P2 means this.

## 7. Open
- Supabase project owner + who gets dashboard access (Tang / Hymn)
- Guy's RN app calls the same FastAPI? (assumed yes)
- Where the real model runs (inside FastAPI, or a separate ML service)
