# 08 Dashboard   2026-11-17

Where: `/dashboard` KPIs + charts. Requirement: Demo item 5 (P5 charts are extra).
Image: `../img/spec-08-dashboard.png`

Tag: **Demo** = before 30 Nov. **Later** = backlog. **Proposed** = new idea from this spec, Tang decides (Demo or Later).
Status: ✅ built · ⬜ not built.

## What it does now
- 4 KPI cards: detections today, confirmed total, correction rate, failed images today.
- Charts (last 7 days): detections per day, pipes per day, correction rate trend, model vs actual. Each has "View as table".
- Refresh button, API chip, empty and error states.

## What to fix
| Issue | Status |
|---|---|
| KPI cards have no change vs yesterday | ⬜ Later (Tang 2026-11-17: skip for the demo) |
| Model vs actual with 1 batch looked odd (axis 40-80, lone "0") | ✅ built: under 3 confirmed batches it is a plain list (DO, model, actual, difference) |

## Function to add
| Function | When |
|---|---|
| Model accuracy over time | Later |
| Filter by date / operator | Later |
