# Requirements

Sources: Pipe_Detector_App_Documentation_Capstone.pdf, "Update งานเพิ่มเติม" doc (05/11/2026), Plan sheet.

## Core (from project doc)
- [ ] Capture or upload photos of steel pipe stacks
- [ ] Show detection + count result
- [ ] User confirms and submits
- [ ] Send data to backend / company DB over REST (JSON, HTTPS)

## Professor requests
- [ ] P1 Pre-capture guidance: move closer, more/less light, nothing blocking the camera
- [ ] P2 Panorama capture: **OPEN**, meaning unclear. Ask the professor before building
- [ ] P3 Multiple photos per capture/upload
- [ ] P4 After capture, show the cropped pipe-only area (so car exhaust pipes etc. are not counted)
- [ ] P5 Compress stored images, visible quality must match the original (prove with SSIM/PSNR)
- [ ] P6 Study case: try one new method that could become the project's innovation
- [ ] P7 Log every problem for the report -> `docs/problem-log.md`

## Demo scope (30 Nov, mock detector)
1. Multi-image capture/upload with per-image status (P3)
2. Mock API returns count + boxes + crop box per image
3. Result screen: cropped image, boxes, count (P4)
4. Tap to add/remove a pipe, count updates
5. Confirm + submit, stored by the backend, history list
6. Guidance v1: brightness + blur check before upload (P1)
7. Compression v1 on upload, original vs compressed size shown (P5)

## Backlog (after 30 Nov)
- Real model integration, push to company DB, auth, panorama, SSIM/PSNR benchmark report, usability test
