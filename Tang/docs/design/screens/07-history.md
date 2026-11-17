# 07 History   2026-11-17

Where: `/dashboard` Recent 10 + batch details dialog. Requirement: Demo item 5 (history = Recent 10, decision 2026-11-09).
Image: `../img/spec-07-history.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- Recent 10 table (cards on phone): time, DO, operator, photos, model, actual, variance, status.
- Click a row (or the DO button) = details dialog: model, actual, variance, photos, operator, created / confirmed time, notes, batch ID. Esc or outside click closes.
- Export CSV of the latest 100 batches.

## What to fix
| Issue | Status |
|---|---|
| Draft rows showed "—" for DO | ✅ built: "Not confirmed yet" in grey |
| Details dialog has no photo | ⬜ Later: demo mode keeps no photos; needs Supabase storage |

## Function to add
| Function | When |
|---|---|
| Click a row to open the batch | Demo ✅ |
| Export CSV | Demo ✅ |
| Filter by date / operator | Later |
| Open a draft to finish it | Later |
