# Plan: light UI (one design) + Docker demo

Decided by Tang, 2026-11-10:
- The whole app follows `docs/design/preview/capture-upload.html` (light: white cards, blue `#2563eb`, gray text). The dark "control room" look (ui-v2) is dropped. The 4 dark previews are deleted so there is ONE design.
- Pages keep their current layout and features (ui-v2 functions stay: camera modal, quality check, compression info, corrections, charts). Only the look changes, except Processing, which copies the capture-upload.html layout.
- Docker: a friend clones the repo, runs `docker compose up --build` in `Tang/`, opens http://localhost:8080 and it works with no keys. Without Supabase keys the API keeps data in memory (lost on restart).

Starting point (already in the working tree, uncommitted): `web/src/index.css` light tokens (same token names), `web/src/lib/i18n.ts` Processing strings copied from the preview.

## Tasks
| # | Owner | Files | Done when |
|---|---|---|---|
| A1 | coder | everything in `web/src` EXCEPT `pages/Processing.tsx`, `components/{PhotoRow,DropZone}.tsx`, `lib/i18n.ts` | no dark leftovers (raw dark rgb/hex in chrome, heavy black shadows, cyan focus glow, `color-scheme: dark`); cards look like the preview `.card` (white, radius 16, soft shadow); header brand blue; Login, Result, Dashboard, dialogs, toast, charts readable on light (WCAG AA text). Photo-like areas (camera viewfinder, photos, pipe illustration) may stay dark. Tests green. |
| A2 | coder | `pages/Processing.tsx`, `components/{PhotoRow,DropZone}.tsx`, `lib/i18n.ts`, their tests | Processing matches capture-upload.html: one card, badge "1" + "ถ่าย / อัปโหลดรูป / Capture / Upload", camera button + "หรือ · or" row, dashed drop zone, limit line `(n/10)`, red alert box, photo list (64px thumb, name, size, status line, quality notes, 44px remove), sticky CTA "⬆ อัปโหลด N รูป · Upload N" -> "กำลังอัปโหลด…" -> "ตรวจผลลัพธ์ · Review results" (goes to /result). Existing features kept (live camera modal, quality check, compression "2.4 MB → 380 KB", per-photo states). Tests green. |
| B | coder | `api/app/{config,repo,main}.py`, `api/tests/*`, `web/src/lib/api.ts` (base URL only), new `api/Dockerfile`, `web/Dockerfile`, `web/nginx.conf`, `*/.dockerignore`, `Tang/docker-compose.yml`, `Tang/README.md` (Docker section) | `DEMO_MEMORY=true` + no Supabase keys -> one shared InMemoryRepo (no 503); without the flag the old 503 stays. `/health` reports `storage: supabase / memory / none`. compose: `api` (python 3.12 slim, uvicorn :8000) + `web` (node build -> nginx :80, published on 8080, proxies `/api/` and `/health` to api, `client_max_body_size` >= 160m). Web built with same-origin API base. pytest + ruff green. |
| C | tester + reviewer | all | web vitest/tsc/lint/build, api pytest/ruff, browser walk at 1366 + 375 on light UI |
| D | scribe | docs | decisions, tech-stack (Docker), delete 4 dark previews, mark `docs/design/ui-v2.md` superseded, problem log if needed |

Docker is not installed on Tang's PC, so the compose file cannot be built here: verify by reading + running the same commands outside Docker. Tang or the friend does the first real `docker compose up`.

## Status (2026-11-10)
- [x] A1 light restyle of all pages: tester PASS + reviewer PASS
- [x] A2 Processing matches capture-upload.html (CTA button, no auto-navigate): PASS
- [x] B DEMO_MEMORY + `/health` storage + Docker files: api 98 tests pass
- [x] C web 196 tests pass, build OK (main JS 420 kB / 128 kB gz), browser walk at 1366 + 375 OK
- [x] D docs updated, 4 dark previews deleted
- [ ] OPEN: first real `docker compose up --build` by Tang / a friend (Docker not installed here)
