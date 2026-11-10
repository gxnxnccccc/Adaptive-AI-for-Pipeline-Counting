# Requirements

Sources: Pipe_Detector_App_Documentation_Capstone.pdf, "Update งานเพิ่มเติม" doc (05/11/2026), Plan sheet.

## Core (from project doc)
- [ ] Capture or upload photos of steel pipe stacks
- [ ] Show detection + count result
- [ ] User confirms and submits
- [ ] Send data to backend / company DB over REST (JSON, HTTPS)

## Professor requests
- [ ] P1 Pre-capture guidance: move closer, more/less light, nothing blocking the camera (v1 done 2026-11-09: brightness + blur check only)
- [ ] P2 Panorama capture: **OPEN**, meaning unclear. Ask the professor before building
- [x] P3 Multiple photos per capture/upload (PASS 2026-11-09)
- [x] P4 After capture, show the cropped pipe-only area (so car exhaust pipes etc. are not counted) (PASS 2026-11-09)
- [ ] P5 Compress stored images, visible quality must match the original (prove with SSIM/PSNR) (v1 done 2026-11-09: compression + sizes shown; SSIM/PSNR proof still missing)
- [ ] P6 Study case: try one new method that could become the project's innovation
- [ ] P7 Log every problem for the report -> `docs/problem-log.md`

## Demo scope (30 Nov, mock detector)
All 7 demo items working with the mock detector (2026-11-09); real-DB end-to-end pending Supabase migrations + keys.
1. [x] Multi-image capture/upload with per-image status (P3) (PASS 2026-11-09)
2. [x] Mock API returns count + boxes + crop box per image (PASS 2026-11-09)
3. [x] Result screen: cropped image, boxes, count (P4) (PASS 2026-11-09)
4. [x] Tap to add/remove a pipe, count updates (PASS 2026-11-09)
5. [x] Confirm + submit, stored by the backend, history list = Dashboard Recent 10 (PASS 2026-11-09)
6. [x] Guidance v1: brightness + blur check before upload (P1) (PASS 2026-11-09)
7. [x] Compression v1 on upload, original vs compressed size shown (P5) (PASS 2026-11-09)

UI: 4-page dark UI (Login, Processing, Result, Dashboard) complete and verified against mocked API on 2026-11-09; remaining before 30 Nov: apply Supabase migrations + keys, manual end-to-end on real DB, demo-room checks (projector contrast, offline fonts).

## Backlog (after 30 Nov)
- Real model integration, push to company DB, auth, panorama, SSIM/PSNR benchmark report, usability test
