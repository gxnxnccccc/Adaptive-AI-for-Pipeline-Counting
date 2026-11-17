# 05 Correct   2026-11-17

Where: `/result`, editing boxes. Requirement: Demo item 4 (tap to edit).
Image: `../img/spec-05-correct.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- Tap a box = remove it (red strike), tap empty space = add a box (green, median pipe size). Undo button or Z.
- Totals update live: Model count → Corrected count, "+1 added", per-photo line "28 → 29".
- Edited photos get a pencil badge in the strip.

## What to fix
| Issue | Status |
|---|---|
| A box added near the photo edge is partly hidden in Pipe-area view | ⬜ Proposed: switch to Full photo or pad the crop when a box is added at the edge |
| Mock detector draws overlapping orange boxes in a grid | ⬜ no action: comes from the mock; recheck with the real model |

## Function to add
| Function | When |
|---|---|
| Drag a box to move / resize it | Later |
| Mark a box "not a pipe" with a reason | Later |
