# Web brief (input for Figma redesign + `designer`)

Source: interview with Tang, 3 Nov 2026 (5 rounds) + Figma Make prototype v11 (last updated 8 May 2026):
https://www.figma.com/make/Fcwtli6ARlTTlMDXUnowlj/Steel-Pipe-Detector-UI-Design

Prototype role: **style reference only**. Keep its look (colors, cards, header, big buttons). Redesign the flow for mobile + multi-image + boxes. The redesigned version becomes the spec source for `designer`.

## 1. Decisions from the interview
| Topic | Decision |
|---|---|
| Now (M1) | Design spec first. No app code before M2 (15 Nov) |
| Users / device | Phone **and** laptop equally -> responsive, mobile first |
| Batch | Many photos, **each photo = a different stack**. Batch total = sum of stack counts |
| Batch fields | DO Number (per batch), pipe size/type (per stack, assumed), note (per stack) |
| DO Number | Real company format, e.g. `DX26030043` = 2 letters + 8 digits. Validate it |
| Correction | Tap a box = remove, tap an empty spot = add, plus +/- buttons as a fallback |
| Actual Amount | **Required.** Worker types their own count per stack. AI count + boxes are the check |
| Mismatch rule (default, confirm) | Typed Actual ≠ box count -> yellow warning, note becomes required, both numbers saved |
| Note | Optional, required only on a mismatch (see above) |
| Low confidence | Yellow boxes. Submit stays disabled until each one is kept or removed |
| Guidance (P1) | Dark/blurry -> warning with Retake / Use anyway. Never blocks |
| Language | TH/EN toggle in the header, Thai by default |
| History | List + detail, filter/search (date, DO Number, pipe size) |
| Roles | Worker + supervisor. Supervisor: sees all workers' history, edits confirmed counts (change logged) |
| Demo 30 Nov | Worker flow only, **no login**. Supervisor + login screens: Figma only, built in Dec (M5) |
| Pipe size list | OPEN, ask the company. Placeholder list until then |

## 2. Screens (demo = worker flow)
| # | Screen | Must show | Demo item |
|---|---|---|---|
| 1 | Capture / Upload | DO Number field, take photo / pick many, thumbnails with remove | 1 (P3) |
| 2 | Upload status | One row per photo: compressing -> uploading -> counting -> done/failed, retry per photo, guidance warning per photo, original vs compressed size | 1, 6, 7 |
| 3 | Stack result | Cropped image (P4), boxes, yellow low-conf boxes, AI count, tap add/remove, +/- , pipe size, Actual Amount, note | 2, 3, 4 |
| 4 | Batch review / Confirm | List of stacks (thumb, AI count, actual, warnings), batch total, Submit (disabled until all stacks reviewed) | 5 |
| 5 | Success | Summary: DO Number, total actual, total AI, stacks, notes. "Start new count" | 5 |
| 6 | History | List (date, DO Number, total, status) + filter/search, tap -> read-only detail with boxes | 5 |
| Later | Login, supervisor history (all workers), supervisor edit + change log | Figma only for now | backlog |

Laptop (>= 1024px): screen 3 = image left, counts/form right. Screen 4/6 = table. Phone: one column, sticky bottom action bar.

## 3. States every screen needs (designer will flag missing ones)
Loading, empty (0 photos / 0 pipes / no history), error (upload failed, API down), dark photo, blurry photo, low-confidence pipes, mismatch warning, offline/slow upload, long Thai labels.

## 4. Style (from the prototype, keep)
| Token | Value |
|---|---|
| Primary | `#2563EB` (blue-600), hover `#1D4ED8` |
| Success / Error | `#16A34A` / `#DC2626` |
| Warning (new, low-conf + mismatch) | yellow/amber, pick in Figma |
| Background / Card | `#F9FAFB` / `#FFFFFF`, rounded-2xl |
| Text | `#1F2937` / `#4B5563`, border `#E5E7EB` |
| Header | App name, status chips (API / Camera), TH/EN toggle |
| Touch targets | >= 44px (prototype: "large for gloved hands") |

Drop from the prototype: desktop-only 3-column layout, single image, one overall confidence %, MUI dependency (use shadcn).

## 5. Scope impact (vs `requirements.md` demo scope)
Added by the interview: DO Number + pipe size + note + Actual Amount fields, mismatch rule, TH/EN toggle, history filter/search. Roughly +1 block. If M4 slips, cut filter/search first.
Moved out: login -> M5 (Dec).

## 6. OPEN
- Pipe size/type list -> ask the company
- Mismatch rule above -> confirm with Tang
- Pipe size per stack or per batch? (assumed per stack) -> confirm with Tang
- Does the model detect pipe size? (prototype mock "detects 5 sizes") -> ask Game/Opor, add to `api-contract.md`
- Supervisor edit log fields (who, when, old -> new, reason) -> design with the Supabase schema in M5
