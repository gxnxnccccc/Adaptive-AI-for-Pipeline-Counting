# 06 Confirm   2026-11-17

Where: `/result` right panel, then the saved toast on `/processing`. Requirement: Demo item 5.
Image: `../img/spec-06-confirm.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- DO number (required), Actual amount (starts at the corrected total, −/+ buttons), flag chip when actual ≠ model, Notes (required, 2000 max).
- Submit Detection saves the batch and goes back to Processing with "Saved DO … Ready for the next batch" (`img/spec-06-confirm-saved.png`).
- Cancel this detection: quiet link, asks first.

## What to fix
| Issue | Status |
|---|---|
| Saved toast covers the step indicator (top right) at 1440 px | ⬜ Proposed: show the toast at the bottom, or under the header |
| Notes required even when actual = model | ⬜ Later (api-contract change) |

## Function to add
| Function | When |
|---|---|
| Send confirmed count to the company DB | Later |
| Print / QR label for the DO | Later |
