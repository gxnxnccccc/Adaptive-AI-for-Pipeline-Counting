# 04 Result   2026-11-17

Where: `/result`. Requirement: Demo items 2, 3 (P4).
Image: `../img/hifi-03-result.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- Photo with boxes (Pipe area / Full photo), count, "to check" chip, photo strip, Totals and Confirm panel on the right.
- Zoom (−/+, Ctrl+wheel, pinch), drag to move when zoomed. Keys: N = next box to check, Z = undo (Thai layout too).
- Save original / Save result PNG, Remove photo.

## What to fix
| Issue | Status |
|---|---|
| 18 orange dashed boxes = noisy | ✅ built: "show only boxes to check" + N = next box |
| Thumbnail strip showed "pipes" twice | ✅ built: number badge 1, 2, 3 on each thumbnail (+ "Photo 2 of 3" for screen readers) |
| Two red buttons (Remove photo, Cancel detection) competed with Submit | ✅ built: Cancel detection is a quiet underlined text link (still asks first) |

## Function to add
| Function | When |
|---|---|
| Zoom / pan | Demo ✅ |
| Keyboard Z / N | Demo ✅ |
| Notes optional when actual = model (api-contract change) | Later |
| SSIM/PSNR quality proof on screen (P5) | Later |
| Send confirmed count to the company DB | Later |
