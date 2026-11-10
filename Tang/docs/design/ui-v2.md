> **SUPERSEDED 2026-11-10.** The whole app now uses the light look of `docs/design/preview/capture-upload.html`. See `docs/plans/light-ui-docker.md`. Kept for the report history; the dark previews are deleted. Functions below still apply, colors do not.

# UI v2: "Dark control room" (4 screens)

Source of truth for the look: the HTML previews in `docs/design/preview/` (decision 2026-11-04: design in code/HTML, not Figma).
Plan: `so-rn-i-wanna-temporal-mountain` task 1. Requirement: demo scope items 1-7.

| Screen | Route | Preview | States in the preview bar |
|---|---|---|---|
| Login | `/login` | `login.html` | default, empty fields, checking API, API offline |
| Processing | `/processing` | `processing.html` | empty, adding, ready, uploading, detecting, done, API error, saved toast, camera live / asking / denied / no camera |
| Result | `/result` | `result.html` | default, with corrections, failed photo, invalid form, submitting, submit error, cancel dialog |
| Dashboard | `/dashboard` | `dashboard.html` | loaded, empty, loading, API error |

Preview tricks: `#state` in the URL opens a state (`result.html#invalid`), `?phone` opens the 375 px phone frame (`dashboard.html?phone#empty`). The black bar on top is preview chrome, not app UI. All data is sample data.

---

## 1. Shared tokens

Identical `:root` block in all 4 files. Contrast measured against `surface` (bg / raised in brackets).

| Token | Hex | Tailwind | Use | Contrast |
|---|---|---|---|---|
| `bg` | `#020617` | slate-950 | page | |
| `surface` | `#0f172a` | slate-900 | cards, sidebar | |
| `raised` | `#1e293b` | slate-800 | hover, secondary buttons, chips | |
| `line` | `#334155` | slate-700 | borders | |
| `line-2` | `#475569` | slate-600 | input borders, axis | |
| `tx` | `#f8fafc` | slate-50 | primary text, numbers | 17.1 (19.3 / 14.0) |
| `tx-2` | `#cbd5e1` | slate-300 | secondary text | 12.0 (13.6 / 9.9) |
| `tx-3` | `#94a3b8` | slate-400 | English line, meta | 7.0 (7.9 / 5.7) |
| `accent` | `#22d3ee` | cyan-400 | primary buttons, detection boxes, focus ring | 9.9; slate-950 text on it 11.2 |
| `ok` | `#4ade80` | green-400 | online, done, user-added box | 10.2 |
| `warn` | `#fbbf24` | amber-400 | low confidence, quality warning, flagged | 10.7 |
| `err` | `#f87171` | red-400 | error, offline, removed box | 6.5 (5.3 on raised) |
| `viz-1` | `#0891b2` | cyan-600 | chart series 1 (model) | 4.8, passes the dataviz validator on surface |
| `viz-2` | `#8b5cf6` | violet-500 | chart series 2 (actual) | 4.2, passes the dataviz validator |
| placeholder | `#7f8ea3` | n/a | input placeholder | 6.0 on bg |

Soft fills = the same colour at 12 % alpha (`bg-cyan-400/12` etc.). cyan-400 / violet-400 failed the chart lightness band, so the charts use the darker steps above.

Type: `IBM Plex Sans Thai` (Thai + Latin in one family) with a `Noto Sans Thai`, `system-ui` fallback. Numbers, IDs, file names and DO numbers use `JetBrains Mono` with `tabular-nums`. Base size 16 px; the English secondary line is 12.5 px in `tx-3`. Radius: 6 / 10 / 14 px (chip, control, card).

Tailwind v4 (`web/src/index.css`):
```css
@import "tailwindcss";
@theme {
  --color-bg:#020617; --color-surface:#0f172a; --color-raised:#1e293b;
  --color-line:#334155; --color-line-2:#475569;
  --color-tx:#f8fafc; --color-tx-2:#cbd5e1; --color-tx-3:#94a3b8;
  --color-accent:#22d3ee; --color-accent-hi:#67e8f9;
  --color-ok:#4ade80; --color-warn:#fbbf24; --color-err:#f87171;
  --color-viz-1:#0891b2; --color-viz-2:#8b5cf6;
  --font-sans:"IBM Plex Sans Thai","Noto Sans Thai",system-ui,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,"Cascadia Mono",Consolas,monospace;
  --radius-card:14px;
}
```
That gives classes like `bg-surface border-line text-tx-2 text-accent font-mono rounded-card`. Recharts takes the hex values (or `var(--color-viz-1)`).

Common pieces (CSS class in the preview, then the component it maps to):
- `.btn-primary` cyan with slate-950 text, `.btn-secondary` raised + line-2 border, `.btn-ghost`, `.btn-danger` red outline. Min height 44 px, `btn-lg` 52 px. Reuse `components/ui/button.tsx` variants.
- `.chip`: `chip-ok`, `chip-warn`, `chip-err`, `chip-acc`. A colour always comes with an icon and a text label.
- `.alert-err / -warn / -ok / -info`: icon, bold Thai line, English line, optional action on the right.
- Labelled inputs are 48 px tall. Errors show under the field (`aria-invalid`, `aria-describedby`); on login a summary alert also shows.
- Focus: a 2 px cyan outline with 2 px offset on everything.
- Bilingual: Thai first, English below or beside it in `tx-3` (the existing `bi()` / `t` in `lib/i18n.ts`).
- Motion: API dot pulse, spinners, scan line on detecting thumbnails, box pop-in on login. All of it turns off under `prefers-reduced-motion`; the scan line becomes a static cyan bar.
- Icons: inline SVG stroke icons (lucide shapes, so `lucide-react` fits). No emoji.

## 2. Shared shell (Processing, Result, Dashboard)

| | Desktop (container ≥ 960 px) | Phone |
|---|---|---|
| Nav | Left sidebar, 248 px, sticky full height. Logo "SPDS" + "ตัวนับท่อเหล็ก · Steel Pipe Detector". Nav: ตรวจนับใหม่ / Processing · New detection, แดชบอร์ด / Dashboard (active = cyan left bar + tint). Bottom: operator (`OP-07` mono), Logout. | Sticky top bar: logo, operator id, logout icon button. Sticky bottom tab bar with 2 tabs, 60 px tall. |
| Header | Route tag (`SPDS / processing`), H1 Thai 28 px + English, actions on the right incl. the **API chip** | Same, wraps |
| Background | `bg` + faint 32 px grid + cyan glow top-left | same |

- API chip: `GET /health` via `getHealth()`. States: `online` (green, pulsing dot), `offline` (red), `checking` (spinner). Poll on mount and on Retry.
- Result counts as part of Processing in the nav (Processing stays active).
- Dialogs and toasts are `position:fixed`.

---

## 3. Login `/login`

**Layout**
- Desktop: 2 columns. Left = illustration panel (drawn pipe stack, boxes pop in, scan line) with the tagline "นับท่อเหล็กจากรูปถ่าย / Photograph the pipe ends. The system counts, you confirm." and 3 step pills (ถ่ายรูป, ตรวจจับ, ตรวจและยืนยัน). Right = sign-in card, max 440 px. No stats.
- Phone: 210 px illustration banner + tagline, card below.

**Components**: `LoginCard`, `ApiChip`, `PasswordInput` (show/hide), `Checkbox`. Reuse `pages/Login.tsx` logic and `lib/auth.tsx`.

**Card, top to bottom**: H1 เข้าสู่ระบบ / Sign in + API chip, then info alert (lock) "demo login, not real security", then [offline warn alert + "Check again"], then [error summary], then Operator ID (mono, user icon), Password (lock icon, eye toggle), Keep me signed in (checked) + "ลืมรหัสผ่าน? Forgot?" (disabled, struck) with the visible hint "ติดต่อผู้ดูแลระบบ · Contact admin", then Sign in (primary, 52 px).

**Interactions**
- Eye button toggles `type`, `aria-pressed` and the label (Show/Hide password).
- Submit with an empty field: summary alert + field errors, focus goes to the first empty field. Typing clears that field's error.
- Submit OK: go to `/processing`.
- Check again: chip shows `checking`, then result.

**States**: default (API online) · empty-field error · checking · offline (warn alert; sign-in still allowed, see Flags).
**Data**: `GET /health` only.

## 4. Processing `/processing`

**Layout**
- Desktop ≥ 1100 px: 2 columns, 5/12 + 7/12.
- Left card "01 · INPUT ถ่าย / อัปโหลดรูป": drop zone (a button; drag and drop or click), then [เปิดกล้อง Open camera] [เลือกรูป Choose photos], then the limits line "สูงสุด 10 รูป รูปละไม่เกิน 15 MB…", then Tips (3 lines).
- Right card "02 · QUEUE รูปที่เลือก" + `n/10`: upload-size bar "12.3 MB → 1.6 MB −87%", photo rows, then a sticky CTA footer with the primary button and helper text.
- Header also shows a 2-step flow: 1 Capture (current), 2 Review & confirm.
- Phone: single column; the CTA sticks above the tab bar.

**Photo row**: thumbnail (crop view, 4:3) · file name (mono, ellipsis) · size `3.1 MB → 412 KB −87%` (P5) · status line · quality chip + hint (P1) · remove ✕ (44 px).

| Status | Look |
|---|---|
| queued | clock, tx-2 "รอคิว · Queued" |
| checking | spinner "กำลังตรวจคุณภาพภาพ… · Checking quality…" (size shows original only) |
| compressing | spinner + progress bar, size `3.1 MB → …` |
| ready | cyan ✓ "พร้อมตรวจ · Ready" |
| uploading | spinner "กำลังอัปโหลด 64%" + bar |
| detecting | cyan border glow, **scan line over the thumbnail**, indeterminate bar |
| done | green ✓ "พบ **44** ท่อ · 44 pipes" (count 22 px mono) |
| failed | red border, "ไม่สำเร็จ · Failed" + reason (2 lines) |

Quality chips (amber): moon "ภาพมืดเกินไป · Too dark" with hint "เพิ่มแสงหรือเปิดแฟลช แล้วถ่ายใหม่"; sun "ภาพสว่างเกินไป · Too bright" with hint "หลบแสงจ้า เปลี่ยนมุมถ่าย"; blur "ภาพเบลอ · Blurry" with hint "ถือกล้องให้นิ่ง ขยับเข้าใกล้ขึ้น". Warnings never block detection; the CTA helper says how many photos have warnings.

**CTA label by state**: 0 photos: "ตรวจจับท่อ" (disabled) + "Add at least 1 photo". Preparing: "Preparing photos…" (disabled). Ready: "ตรวจจับท่อ 4 รูป · Detect pipes (4)". Running: "Uploading 64%" / "Detecting…" (disabled) + "Keep this page open". Error: "ลองใหม่ · Try again". While running, the remove buttons, drop zone and camera/choose buttons are disabled.

**Camera modal** (`components/CameraModal.tsx`)
- Live: viewfinder 4:3 (fills the screen on phone), cyan corner guides, "สด · Live" chip, hint "จัดปลายท่อให้อยู่ในกรอบ", taken counter + mini thumb, 72 px round shutter (white flash), Done.
- Asking: shield + spinner, "Click Allow in the browser prompt".
- Denied: red camera-off + how to allow, [Try again] [Choose photos instead].
- No camera: [Choose photos instead].
- Esc / ✕ closes. Done adds the shots to the queue (they go through checking → compressing).

**Other states**
- Done: green banner "ตรวจจับเสร็จ: นับได้ 3 จาก 4 รูป พบ 120 ท่อ" + "ไปตรวจผล Review" and a progress bar, then auto-navigate to `/result`.
- API error: red banner "ส่งรูปไม่สำเร็จ: เชื่อมต่อ API ไม่ได้ … Your photos are kept", rows go back to ready, chip offline.
- Saved toast (after a submit): green, top-right, "บันทึก DO DX26030043 แล้ว · Saved DO …", ✕, auto-hide after about 5 s.

**Data**: `POST /api/counts` (images[], operator_id) through `lib/api.ts` + the `lib/detection.ts` adapter: `count`, `pipes[]`, `crop_box`, `quality.brightness/blur`, `original_bytes`, `error` per image. Compressed size comes from the client (`lib/compress.ts`); the API has no `stored_bytes` yet.

## 5. Result `/result`

**Layout**
- Desktop ≥ 1180 px: viewer card (fluid) + right panel 400 px (sticky).
- Header: "← กลับไปหน้าตรวจนับ Back to processing" (ghost), H1 "ตรวจผลและยืนยัน / Review & confirm", batch chip `Batch 3f9c…a21e · draft`, API chip.
- Phone: stacked; the viewer is square; the strip scrolls sideways inside itself.

**Viewer card**
1. Toolbar: file name (mono) + "รูป 1/4 · Photo 1 of 4" · **count chip** (`45` 28 px mono + ท่อ pipes) · amber "ควรตรวจ 3 · to check" chip · segmented toggle **พื้นที่ท่อ Pipe area / ทั้งภาพ Full photo** (P4, default Pipe area = viewBox set to `crop_box`).
2. Viewer: black, cyan HUD corners, cursor crosshair. Nothing sits on top of the photo, so every box stays tappable.
3. Help row: info icon "แตะกรอบเพื่อลบ · แตะที่ว่างเพื่อเพิ่ม / Tap a box to remove it, tap empty space to add a pipe" + Undo.
4. Legend: Detected (cyan solid) · Low confidence (amber dashed) · Removed (red dashed + diagonal strike, faded) · Added by you (green + tint).
5. Actions: Save original · Save result PNG (corrected boxes, `lib/annotate.ts`) · Remove photo (red, right; disabled when only 1 photo is left).
6. Strip "รูปทั้งหมด · All photos": 136 px thumbs (crop + boxes), name, count chip, green pencil badge when edited, failed = red tint + "ล้มเหลว" chip. Selected = cyan ring, `aria-pressed`.

**Failed photo**: viewer shows the photo dimmed with "ตรวจจับรูปนี้ไม่สำเร็จ / Detection failed for this photo", the reason, "Not counted in the totals". Count/toggle chips are hidden and Save result is disabled.

**Right panel**
- "03 · COUNT สรุปจำนวน": Model count (40 px mono) → **Corrected count** (cyan, tinted box), chips "− 1 ลบ removed" / "+ 3 เพิ่ม added" (or "No corrections yet"), rows: Mean confidence (meter + %), Low-confidence boxes, Photos counted `3/4` + "1 failed" chip, per-photo list `IMG_0412.jpg 44 → 45`.
- "04 · CONFIRM": error alert (submit error) · DO Number * (mono, max 64) · Actual amount * as a stepper [−][input][+] (52 px) with a **variance badge** on the label row (`✓ ตรงกับโมเดล` green, or `⚑ +2 เทียบกับโมเดล · vs model` amber), a helper line "Defaults to the corrected total (122)" / "Differs from the corrected total", and a flag note when ≠ model ("this batch will be flagged") · Notes * (textarea, `0/2000` counter) · Submit (primary 52 px, disabled until valid, helper text says what is missing) · Cancel this detection (red outline).

**Interactions**
- Click a box: removed (red, struck); click again to restore. Click an added (green) box: it is deleted. Click empty space: add a box at that point, size = median box of the photo. Undo per photo.
- Every change updates the toolbar count, strip chip, totals and Actual (until the user edits Actual by hand).
- Per-box changes are sent with the confirm (plan task 7: `corrections[]`).
- Submit: button shows a spinner "กำลังส่ง…", fields and viewer are locked; on success, clear the session and go to `/processing` with the saved toast. On error: alert, everything is kept, button becomes "ลองส่งใหม่ Try again", chip offline if the API is down.
- Cancel: alertdialog "ยกเลิกการตรวจนับนี้และเริ่มใหม่?", body "…the batch stays as a draft in Recent", [ไม่ ทำต่อ] (focused) [ใช่ ยกเลิก] (red solid). Esc = No.

**States**: default (no edits, empty form) · with corrections (remove 1 false box + add 3 missed, actual 122, +2 vs model) · failed photo · invalid (errors under DO / Actual −1 / Notes) · submitting · submit error · cancel dialog.

**Data**: from the detection session (`count`, `pipes[].box/confidence`, `crop_box`, `error` per image); `POST /api/counts/{batch_id}/confirm` with `do_number`, `actual_amount`, `notes`, `image_ids` (kept photos) + planned `corrections`.

## 6. Dashboard `/dashboard`

**Layout**
- Header actions: "อัปเดต 10:42 / Updated 10:42" · Refresh (secondary) · ตรวจนับใหม่ New detection (primary; hidden on phone because the tab bar has it) · API chip.
- KPI row: 4 cards (2 × 2 on phone, footnotes hidden on phone). Each card: icon tile, Thai + English label, a 44 px mono value, and a footnote with the definition.

| KPI | Field (`GET /api/stats`) | Note |
|---|---|---|
| ตรวจนับวันนี้ · Detections today | `detections_today` | "Batches created today, Bangkok time" |
| ยืนยันแล้วทั้งหมด · Confirmed total | `confirmed_total` | "All time" |
| อัตราการแก้ไข · Correction rate | `correction_rate` × 100 % + meter | `null` → "—" + "Nothing confirmed yet" |
| รูปที่ล้มเหลววันนี้ · Failed images today | `failed_images_today` | icon tile turns red when > 0 |

**Charts** (2 × 2 at ≥ 1100 px, 1 column below). Each chart is a card: title Thai + English subtitle, chart 230 px, "ดูเป็นตาราง · View as table" `<details>`, hover/focus tooltip, today's tick bold ("วันนี้ 09/11"). Ticks show the Thai day abbreviation over `dd/mm`.

| Chart | Form | Data | Notes |
|---|---|---|---|
| Detections per day, 7 days | bars, `viz-1`, 4 px rounded tops | `GET /api/stats/daily?days=7` → `detections` (planned, task 9) | 7-day total top-right, only today's bar labelled |
| Pipes counted per day | bars, `viz-2` | same → `pipes_actual` | 7-day total |
| Correction rate trend | 2 px line, `viz-1`, 10 px markers with a surface ring, y 0-50 % | same → `correction_rate` | `null` days = gap + note "Days with nothing confirmed are left blank", last point labelled |
| Model vs actual, last 10 confirmed | dot plot: model = hollow cyan ring, actual = violet square, connector when different | `GET /api/counts?status=confirmed&limit=10` | legend (2 series), signed variance column on the right (bold when ≠ 0) |

**Recent 10** (`GET /api/counts?limit=10`, all statuses): Time · DO number · Operator · Photos · Model · Actual · Variance · Status. Numbers in mono, right-aligned; draft shows "—". Status chip: ยืนยันแล้ว Confirmed (green ✓), ต้องตรวจสอบ Flagged (amber ⚑, `flagged`), ฉบับร่าง Draft (neutral ✎). On phone each row becomes a card (time + status, DO, then the labelled fields).

**States**
- Loaded.
- Empty: KPIs 0 / 0 / — / 0; one empty card with dashed bars, "ยังไม่มีข้อมูล เริ่มตรวจนับครั้งแรกได้เลย", "Charts appear after the first confirmed detection" and a big New detection button; Recent shows "No records yet". No fake numbers.
- Loading: skeleton values, charts and rows; Refresh shows a spinner and is disabled.
- API error: red alert + Retry, KPIs "—", charts and recent hidden, "Not updated", chip offline.

---

## 7. Flags / OPEN (ask before coding)
1. **Per-photo progress vs one request.** `POST /api/counts` is a single multipart request, so uploading % and "detecting" are batch-level: all rows move together and only done/failed arrive per photo. The preview shows it that way. Truly per-photo progress would need an API change.
2. **Login while the API is offline**: the preview lets the user sign in (mock auth) with a warning. Tang to confirm, or block the button instead.
3. **Thresholds OPEN**: low confidence = 0.5 (matches `LOW_CONFIDENCE`); dark / bright / blurry numbers are still to be tuned (`api-contract.md`).
4. **`crop_box` source OPEN**: the preview uses pipe boxes + 18 px padding. Added-box size = median box (circle vs box still OPEN with the ML team).
5. **`GET /api/stats/daily` does not exist yet** (plan task 9). Fields assumed: `date, detections, pipes_actual, correction_rate|null`.
6. **Fonts come from Google Fonts.** If the 30 Nov demo room is offline they fall back to Noto Sans Thai / system. Self-host (`@fontsource/ibm-plex-sans-thai`, `@fontsource/jetbrains-mono`) for safety.
7. **Keyboard access to box editing**: boxes are not in the tab order (up to ~120 targets). The keyboard path is the Actual amount stepper. OK for the demo; revisit later.
8. Model vs actual: differences are 1-3 pipes out of ~100, so the dots nearly overlap. The variance column carries the message. If the team wants the difference itself, swap to a diverging "actual − model" bar per batch.
9. "Back to processing" from Result: does it keep the photos (new detect = another draft batch) or discard? The preview keeps them.
10. `designer.md` still says "Figma is source of truth"; update it to point at these HTML previews.
