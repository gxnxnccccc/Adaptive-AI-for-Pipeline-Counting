# 03 Upload status   2026-11-17

Where: `/processing`, while uploading and after. Requirement: Demo item 1 (P3).
Image: `../img/spec-03-upload-status.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- Upload N sends all ready photos in one request; each row says Sending…, the button says Uploading… and "keep this page open".
- Done: green banner "Detection complete: 2 of 2 photos counted, 38 pipes", each row shows its count, the button becomes Review results.
- Error: photos stay, the button becomes Try again; a failed photo shows the reason.

## What to fix
| Issue | Status |
|---|---|
| After Done, the drop zone and Take photo stay but look greyed, like something broke | ⬜ Proposed: hide them after Done, or one line "Review these first" |
| No per-photo progress during upload (one request for all) | ⬜ Later: only matters with the real model on slow Wi-Fi |

## Function to add
| Function | When |
|---|---|
| Cancel an upload in progress | Later |
| Upload progress % | Later |
