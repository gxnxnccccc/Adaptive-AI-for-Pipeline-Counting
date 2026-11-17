# Design week: 4 hi-fi frames (new deep-blue / pink style)   2026-11-16

Frames = the real app at 1440 px (mock API, demo password `spds`) + a notes card each.
Images: `img/hifi-0{1-4}-*.png`. Figma-ready HTML (fonts + images inlined, media queries flattened): `hifi-frames.html`, one frame per `.board`.
Figma file: "SPDS · Design Week (hi-fi)" (created, still empty: the upload from the cloud was blocked, see problem-log).

Tag: **Demo** = before 30 Nov. **Later** = backlog.

**8 screen specs (2026-11-17):** `screens/01-login.md` … `screens/08-dashboard.md`. The 4 extra screens (Upload status, Correct, Confirm, History) are states inside the 4 pages, so they have screenshots (`img/spec-0*.png`), not new pages. Figma: skipped (Tang 2026-11-17, specs only).

## 01 Login
| What to fix |
|---|
| Crew sits low, empty gap under the tagline at 1440x900: centre it or scale it up ✅ built (top trimmed, 720 px) |
| Build stamp under the card reads like debug text: smaller, hide in the final demo build ✅ built (10 px corner, live app only) |
| Big empty grey area right of the card: recheck on the projector |

| Function to add | When |
|---|---|
| Caps Lock warning under the password | Demo ✅ built |
| Crew waves / jumps once on a correct login | Demo ✅ built |
| Real sign-in (Supabase Auth) instead of `spds` | Later |
| Forgot-password flow | Later |

## 02 Processing
| What to fix |
|---|
| Same photo can be added twice: warn on duplicates ✅ built (skipped + "Skipped 1 photo already in the list") |
| Desktop uses only a narrow centre column: tips or last batch on the right ✅ built (tips card) |
| Compression line shows even for a tiny saving (-6%): show it only when it matters ✅ built (20% or more) |

| Function to add | When |
|---|---|
| Pre-capture tips card (P1) with good/bad example photos | Demo ✅ built (drawn examples, right column on desktop, closed bar on phone) |
| Green "photo OK" check per row, not only warnings | Demo ✅ built |
| Panorama capture (P2, OPEN with the professor) | Later |
| DO number entered before upload | Later |

## 03 Result
| What to fix |
|---|
| 18 low-confidence boxes all dashed orange = noisy: "show only boxes to check" ✅ built (tap the to-check chip) + "next box" ✅ built (N) |
| Thumbnail strip shows "pipes" twice: add the photo number ✅ built |
| Two red buttons (Remove photo, Cancel detection) compete with Submit: Cancel as a quiet text link ✅ built |

| Function to add | When |
|---|---|
| Zoom / pan on the photo | Demo ✅ built (+/- buttons, Ctrl+wheel / pinch, drag to pan) |
| Keyboard: Z = undo, N = next low-confidence box | Demo ✅ built (works on the Thai layout too) |
| Notes optional when actual = model (api-contract change) | Later |
| SSIM/PSNR quality proof on screen (P5) | Later |
| Send confirmed count to the company DB | Later |

## 04 Dashboard
| What to fix |
|---|
| KPI cards have no change vs yesterday: add a delta (already in backlog) → Later (Tang 2026-11-17) |
| Model vs actual with 1 batch looks odd (axis 40-80, lone "0"): simple list under 3 batches ✅ built |
| Draft rows show "—" for DO: "Not confirmed yet" ✅ built |

| Function to add | When |
|---|---|
| Click a recent row to open that batch | Demo ✅ built (details dialog from the loaded row) |
| Export recent batches as CSV | Demo ✅ built |
| Filter by date / operator | Later |
| Model accuracy over time | Later |

Tang picked 3 Demo items (2026-11-16): Caps Lock, show only boxes to check, Export CSV. The other 6 Demo items were built on 2026-11-17: all Demo items done.
What to fix (2026-11-17): all built except the projector check (Tang) and the KPI delta (Later, Tang's choice).
