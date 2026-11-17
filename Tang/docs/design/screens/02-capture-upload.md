# 02 Capture / Upload   2026-11-17

Where: `/processing`, before upload. Requirement: Demo items 1, 6 (P1, P3).
Image: `../img/hifi-02-processing.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- Take photo (camera) or choose / drop up to 10 photos, 15 MB each.
- Each photo is checked (light, blur) and compressed in the browser, one at a time.
- Right column on desktop (closed bar on phone): how to take a good photo, 1 good + 3 bad examples.

## What to fix
| Issue | Status |
|---|---|
| Same photo could be added twice | ✅ built: skipped, with the line "Skipped 1 photo already in the list" (same name + size + date) |
| Desktop used only a narrow centre column | ✅ built: tips card in the right column |
| Compression line showed for a tiny saving (-6%) | ✅ built: "3.0 MB → 400 KB −87%" only when it saves 20% or more; otherwise just the size sent |

## Function to add
| Function | When |
|---|---|
| Pre-capture tips card (P1) with good/bad examples | Demo ✅ (drawn examples; real photos if Tang sends them) |
| Green "photo OK" per row | Demo ✅ |
| Panorama capture (P2, OPEN with the professor) | Later |
| DO number entered before upload | Later |
