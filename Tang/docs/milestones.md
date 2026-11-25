# Milestones (source: Tang's Google Calendar + Plan sheet, 2 Nov 2026)

Today's work = the NEXT unfinished milestone, nothing later. Demo item numbers refer to `requirements.md`.

| ID | Date | What | Done when | Demo items |
|---|---|---|---|---|
| **M1** | Sun 8 Nov | **Figma wireframes + API contract draft. No app code.** | 6 wireframe frames in Figma (`01 Wireframes`: Capture/Upload, Upload status, Result, Correct, Confirm, History). `docs/api-contract.md` sent to Game/Opor/Hymn with the OPEN questions. Panorama question sent to the professor | none (design + contract) |
| M2 | Sun 15 Nov | Scaffold `web/` + `api/`. Multi-image capture/upload with per-image status. Mock endpoint | Pick 5 photos on a phone, see per-image status, mock API answers | 1, 2 |
| M3 | Sun 22 Nov | Mock result: cropped image + boxes + count, tap add/remove, confirm/submit | Full flow works on a real phone | 3, 4, 5 |
| M4 | Sun 29 Nov | Guidance v1 (brightness/blur), compression v1, history list, demo rehearsal | Rehearsed run, problem log current | 5, 6, 7 |
| DEMO | Mon 30 Nov | Self checkpoint, prototype with mock detector | | all |
| M5 | Sun 20 Dec | Supabase DB + image storage, compression benchmark (SSIM/PSNR) | | backlog |
| M6 | Sun 31 Jan | Real model output integrated | | backlog |
| M7 | Sun 28 Feb | Real-pipe tests with company photos | | backlog |
| M8 | Sat 28 Mar | Finalize system + report | | backlog |

## Capacity before M1
Blocks (08:30-11:30): Tue 3 Nov, Wed 4 Nov. Hong Kong trip 5-7 Nov = no blocks. Sun 8 Nov 10:30-11:30 = review. So about 7 h + 1 h.
Realistic M1 = Figma wireframes + a tightened api-contract. Don't start coding before M2.

## Rules
- Don't build a later milestone's items before the current one is done.
- A new screen needs its Figma frame (+ `docs/design/<screen>.md`) before the coder starts.
- Web vs React Native for the demo is decided: **web** (Guy does React Native).
