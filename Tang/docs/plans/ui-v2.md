# Plan: ui-v2 (4 pages, "Dark control room")
Goal: rebuild the web app as Login / Processing / Result / Dashboard in the approved dark look, wired to the existing API. | Requirement: demo scope items 1-7 (P1, P3, P4, P5, item 4 tap-to-edit, item 5 history = Recent 10).

Inputs: master plan `~/.claude/plans/so-rn-i-wanna-temporal-mountain.md`, design spec `docs/design/ui-v2.md` + `docs/design/preview/{login,processing,result,dashboard}.html` (approved by Tang 2026-11-09), `docs/api-contract.md`, current `web/src/**`.
Already done (reuse, do not redo): master task 5 `lib/quality.ts` + `lib/compress.ts`, task 7 API `corrections[]` on confirm, task 9 `GET /api/stats/daily` (types already in `lib/api-types.ts`). Branch: `tang/dark-ui`. **Tang: commit the uncommitted task 5/7/9 work before task 3a starts.**

## Tang's answers (2026-11-09)
| Flag | Answer | What the plan does |
|---|---|---|
| Per-photo progress | OK as is | Per photo before upload: checking -> compressing -> ready. Shared phase for all rows: uploading -> detecting (one `POST /api/counts`). Per photo after: done / failed. No API change. |
| Login while API offline | Allowed, with warning | Warn alert + "Check again"; Sign in stays enabled. |
| Result "Back to processing" | Keep photos; adding photos + detecting again must not lose corrections | See "Back to processing" below (task 8d). |
| Fonts | `@fontsource` (IBM Plex Sans Thai, JetBrains Mono) | Task 3a. Works offline at the demo. |
| Charts | `recharts` | Task 10b. |
| Thresholds / crop_box | Stay OPEN | Named constants + `lib/detection.ts` adapter only. |

## Back to processing: simplest correct option
One upload = one batch id, and confirm takes one batch id, so new photos cannot join the old batch without an API change.
- **Chosen (no API change):** corrections live in the session in image-pixel space (`removed` = model pipe index, `added` = boxes). On re-detect, upload kept photos (same compressed `File` objects) + new photos as **one new batch**. Then `rebaseEdits(oldPipes, newPipes, edits)` remaps each removed index to the new pipe with the same box (exact match first, else IoU >= 0.9); added boxes carry over unchanged. A removed pipe with no match is dropped and the Result page shows "N corrections could not be kept on IMG_x, check again". The mock detector is deterministic (same bytes -> same boxes, `detector.py` uses Hough + crc32), so nothing is lost today.
- Cost: the old batch stays a **draft** (shows in Recent 10, adds 1 to "Detections today"). Same as Cancel today.
- Not chosen: append-to-draft endpoint (`POST /api/counts/{batch_id}/images`). Cleaner, but an API change -> listed in OPEN, not built.
- Fallback if 8d is cut: Back keeps the session read-only (done rows, add/camera disabled with hint "ส่งผลหรือยกเลิกก่อนเพิ่มรูป · Submit or cancel first to add photos"). Still loses nothing.

## Shared rules for every task
- Coder writes only inside `Tang/web/` (no API task in this plan). Skills: `karpathy-guidelines` always, `ui-ux-pro-max` for page tasks, `dataviz` for 10b, TDD for `lib/corrections.ts` and chart-data transforms.
- Every task is done only when `cd Tang/web && npm run test && npx tsc -b && npm run lint` pass, plus the task's own checks. Visual checks at 1366 px and 375 px against the matching preview state (`preview/<page>.html#<state>`).
- Strings go in `lib/i18n.ts` (Thai first, `bi()`), icons from `lucide-react`, colours only through the `@theme` tokens (no `gray-*` / `blue-*` left in a page once its task is done).
- Model fields are read only in `lib/detection.ts`; API calls only in `lib/api.ts`.
- Boxes are in the pixel space of the **uploaded (compressed) file**. Viewer, thumbnails and Save result PNG must use `upload` (compressed) `File`; only "Save original" uses the original file.
- Session is in memory only (React context). Page reload = session gone, Result redirects to Processing; the draft batch stays in the DB.

## Tasks
3a. [x] **Theme + fonts + shell look** | files: `web/src/index.css`, `web/src/main.tsx`, `web/package.json`, `web/src/components/ui/button.tsx`, `web/src/components/ApiChip.tsx` (new, with `useApiHealth()`), `web/src/components/AppShell.tsx`, `web/src/components/ApiChip.test.tsx`, `web/src/App.test.tsx` | reuse: `getHealth()` from `lib/api.ts`, `useAuth()`, `bi()/t` | details: replace the shadcn oklch block with the `@theme` tokens from spec section 1 (note: design `--color-accent` clashes with shadcn's `accent`, so rewrite the button variants to `primary` (accent bg, slate-950 text), `secondary` (raised + line-2), `ghost`, `danger` (err outline), sizes 44 / 52 px, 2 px cyan focus outline). `npm i @fontsource/ibm-plex-sans-thai @fontsource/jetbrains-mono`, import 400/500/600/700 + mono 400/600 in `main.tsx`. AppShell: 248 px sidebar on desktop (logo, Processing + Dashboard nav, operator mono, Logout), sticky top bar + 60 px bottom tab bar on phone, page header slot with route tag + API chip, faint grid background, `prefers-reduced-motion` turns animations off. Remove the Records nav link and the records badge (`getCountsTotal` call). | done when: ApiChip test shows online / offline / checking from a mocked `getHealth` and Retry re-checks; App test: nav has exactly 2 links; DevTools Network shows fonts served from localhost with "Offline" ticked; `grep -rE "bg-background|text-muted-foreground|border-input|bg-primary-foreground" web/src` finds nothing.

3b. [x] **Routes + detection session + thin flow** | files: `web/src/App.tsx`, `web/src/lib/detection-session.tsx` (new), `web/src/lib/detection-session.test.tsx`, `web/src/pages/Processing.tsx` (new, thin), `web/src/pages/Result.tsx` (new, thin), `web/src/App.test.tsx`; delete `pages/NewDetection.tsx`, `pages/NewDetection.test.tsx`, `pages/Submitted.tsx`, `components/Stepper.tsx` | reuse: `pages/Capture.tsx` (inside thin Processing), `components/ResultCard.tsx` + `components/ConfirmForm.tsx` (inside thin Result), `confirmBatch` | details: routes `/login`, `/processing`, `/result`, `/dashboard`, `*` -> `/processing`; Login and Dashboard links point to `/processing`. Context `DetectionSessionProvider` (inside `AuthProvider`, above `Routes`): `session: { batchId, photos: SessionPhoto[] } | null`, `SessionPhoto = { id, original: File, upload: File, originalBytes, uploadBytes, quality: Quality | null, result: DetectedImage }`, actions `start(batchId, photos)`, `removePhoto(id)`, `clear()`, `lastSavedDo` + `setLastSavedDo`. Thin Processing: Capture `onDone` -> `start()` -> navigate `/result`. Thin Result: no session -> `<Navigate to="/processing">`; submit -> `confirmBatch` -> `clear()` -> `/processing`. | done when: session test: start/remove/clear; App test: `/result` with no session lands on `/processing`, unknown route lands on `/processing`, logged-out user lands on `/login`; manual: upload -> result -> submit -> back on Processing with the API running.

**Accepted deviations (3a/3b)** (tester + reviewer PASS 2026-11-09, after 1 fix loop):
- Session stays flat (`photos`, `batchId`; `batchId === null` = no session) until 6a. API: `start(batchId, photos)`, `removePhoto(id)`, `lastSavedDo` / `setLastSavedDo`, `clear()` (keeps `lastSavedDo`); resets on operator change. **6a must** add `SessionPhoto` (original + upload File, sizes, quality) in `detection-session.tsx` and stop importing `Photo` from `components/ResultCard.tsx` (8b deletes it).
- Health hook is `useApiStatus` (in `components/ApiChip.tsx`, not `useApiHealth`); ApiChip tests live in `App.test.tsx`; the `recheck` / "Check again" test moves to task 4.
- Button variants: `primary` (default), `danger`, `outline` (temporary, remove in 10a).
- `components/Stepper.tsx` deletion moves to 6a/8b (still used); `StepCard.tsx` keeps a light panel until 6a/8b.
- Submitted page already replaced by the "Saved DO" toast on Processing (top-[70px], 5 s auto-close). It can cover the API chip for ≤5 s (matches preview, accepted). Proper `Toast` component with a live region stays in 8c.
- Mono font weights 400/500/700 (as in preview); Thai 400/500/600/700.
- Dashboard duplicate `<h2>` removed early; rest of the Dashboard restyle stays in 10a.

4. [x] **Login restyle** | files: `web/src/pages/Login.tsx`, `web/src/pages/Login.test.tsx` (new), `web/src/lib/i18n.ts` | reuse: `useAuth().login`, `ApiChip` / `useApiHealth` from 3a, button variants | details: per spec section 3: 2 columns desktop (illustration panel with pipe stack, box pop-in, scan line, tagline, 3 step pills), 210 px banner on phone; card with H1 + API chip, demo-login info alert, offline warn alert + "Check again" (Sign in stays enabled), error summary alert, Operator ID (mono, icon), password with eye toggle (`aria-pressed`, label changes), keep signed in, disabled Forgot + visible "Contact admin" hint, 52 px Sign in. Empty submit: summary + field errors (`aria-invalid`, `aria-describedby`), focus first empty field, typing clears that field's error. Success -> `/processing`. | done when: Login test: empty submit shows summary + 2 field errors and focuses Operator ID; typing clears its error; eye toggles `type` and `aria-pressed`; offline `getHealth` shows the warn alert and Sign in still logs in and lands on `/processing`.

**Accepted deviations (4)** (tester + reviewer PASS 2026-11-09, 0 fix loops):
- Offline warning stays visible while "Check again" runs.
- SPDS brand mark is duplicated in Login (not shared with AppShell); extract a shared `BrandMark` in 10a/11.

6a. [x] **Processing page: queue, check, compress, detect** | files: `web/src/pages/Processing.tsx` (full version), `web/src/lib/prepare.ts` (new: `preparePhoto(file, onStatus)` = `checkImageQuality` then `compressImage`), `web/src/components/PhotoRow.tsx` (new, replaces `ImageList.tsx`), `web/src/pages/Processing.test.tsx`, `web/src/lib/i18n.ts`; delete `pages/Capture.tsx`, `pages/Capture.test.tsx`, `components/ImageList.tsx`, `components/StepCard.tsx` | reuse: `components/DropZone.tsx` (restyle only; keep its tested drag/drop + same-file re-pick logic), `lib/quality.ts`, `lib/compress.ts` (`formatBytes`), `uploadImages` + `toDetectedImages`, MAX_FILES / MAX_FILE_MB checks from `Capture.tsx` | details: 2 columns (5/12 input card, 7/12 queue card) per spec section 4. Rows run `queued -> checking -> compressing -> ready` one photo at a time; decode error -> row failed "อ่านรูปไม่ได้ · Can't read this photo" and is not uploaded. Quality chips (dark / bright / blurry + hint) never block. Size line `3.1 MB -> 412 KB -87%` + total bar. CTA labels by state (0 photos / preparing / ready N / running / error). Detect: all ready rows -> one `uploadImages(uploads)`, rows show shared "กำลังอัปโหลดและตรวจจับ… · Uploading & detecting…" with scan line on thumbnails (static bar under reduced motion), inputs + remove disabled. Response -> per-row done (count) / failed (reason) -> green banner -> `start()` session -> navigate `/result` after ~1.5 s. API error -> red banner "Your photos are kept", rows back to ready. Phone: CTA sticky above the tab bar. | done when: test (mocked quality/compress/upload): adding 3 files shows 3 rows that reach "ready" with size lines; a mocked dark photo shows the "Too dark" chip and the CTA still says Detect (3); a failed upload shows the red banner and rows are ready again; a successful upload calls `start()` with 3 photos whose `upload` is the compressed file, then lands on `/result`; 11 files -> 10 rows + notice.

**Accepted deviations (6a)** (tester + reviewer PASS 2026-11-09, 0 fix loops):
- Per photo: checking -> compressing; then one shared uploading/detecting phase for all rows (one POST).
- `Stepper` / `StepCard` deletion moved to 8b (done there).

6b. [x] **CameraModal** | files: `web/src/components/CameraModal.tsx` (new), `web/src/components/CameraModal.test.tsx`, `web/src/pages/Processing.tsx` (Open camera button), `web/src/lib/i18n.ts` | reuse: Processing `addFiles()` (shots go through checking -> compressing like picked files), DropZone's `<input capture="environment">` as fallback | details: `getUserMedia({ video: { facingMode: 'environment' } })`; states asking / live / denied (`NotAllowedError`) / no camera (`NotFoundError` or no `navigator.mediaDevices`); live = 4:3 viewfinder (full screen on phone), corner guides, Live chip, shot counter + mini thumb, 72 px shutter (flash off under reduced motion), Done. Capture = canvas -> JPEG `File` named `camera-<n>.jpg`. Esc / X close; tracks always stopped on close/unmount. No `getUserMedia` (e.g. phone on plain http) -> Open camera opens the `<input capture>` picker instead. | done when: test with mocked `mediaDevices`: resolve -> live state; reject NotAllowedError -> denied with Try again + Choose photos; reject NotFoundError -> no-camera state; Done with 2 shots calls `onShots` with 2 Files; closing calls `track.stop()`; manual on laptop webcam: 2 shots appear as queue rows.

**Accepted deviations (6b)** (tester + reviewer PASS 2026-11-09, 0 fix loops):
- Open camera button lives in `DropZone` (not directly in Processing).
- Several shots per open; Done hands all shots over; X / Esc discards unsent shots.
- Shots named `camera-<timestamp>.jpg`, JPEG quality 0.92.
- `NotAllowedError` / `SecurityError` -> denied; every other error -> no camera.
- No `getUserMedia` (phone over plain http) -> native `<input capture="environment">` fallback.

6c. [ ] **NOT BUILT: cut, pending Tang's OK (demo works without it). Upload progress % (cuttable)** | files: `web/src/lib/api.ts` (`uploadImages(files, operatorId, onProgress?)` via `XMLHttpRequest`, `upload.onprogress` -> fraction, `upload.onload` -> detecting), `web/src/lib/api.test.ts`, `web/src/pages/Processing.tsx` | reuse: current `uploadImages` error handling (`errorText`-style message), `CountsResponse` type | details: rows show "กำลังอัปโหลด 64%" + bar, then "กำลังตรวจจับ… · Detecting…" with indeterminate bar; CTA "Uploading 64%" / "Detecting…". | done when: api test with a fake XHR: progress events call `onProgress(0.5)`, load resolves the parsed JSON, status 503 rejects with the API `detail`; manual with throttled network (DevTools "Slow 4G") shows the % climbing then "Detecting…".
- Moved out of 6c to 10a: `uploadImages` error text via `errorText()` + network `TypeError` message.

8a. [x] **Corrections lib (TDD) + PhotoViewer** | files: `web/src/lib/corrections.ts` (new), `web/src/lib/corrections.test.ts` (write first), `web/src/components/PhotoViewer.tsx` (replaces `components/BoxOverlay.tsx`), `web/src/components/PhotoViewer.test.tsx`, `web/src/lib/detection-session.tsx` (add `edits: Record<photoId, PhotoEdits>` + `setEdits`) | reuse: `toRect`, `Box`, `LOW_CONFIDENCE` from `lib/detection.ts` | details: `PhotoEdits = { removed: number[]; added: Box[]; history: Action[] }`; pure functions `toggleRemoved(e, i)`, `addBox(e, box)`, `deleteAdded(e, j)`, `undo(e)`, `correctedCount(modelCount, e)`, `medianSize(pipes)` (fallback `DEFAULT_BOX_FRACTION` of the short side when 0 pipes, OPEN), `boxAt(point, size, imageW, imageH)` (centred, clamped inside the image), `hitTest(point, pipes, added)` (added boxes first, then model boxes), `totals(photos, edits)` (model total + corrected total + removed/added counts over non-failed photos), `toCorrections(photos, edits)` -> `[{ image_id, added, removed }]` only for kept non-failed photos with edits. PhotoViewer = one `<svg viewBox>` with `<image href>` + rects: viewBox = `cropBox` (+ padding) or full image (`view` prop), styles per legend (cyan solid, amber dashed low-conf, red dashed + strike removed, green + tint added), `onPick(point)` in image pixels (convert with `getScreenCTM().inverse()` in one small helper so tests can mock it), `readOnly` mode for thumbnails. | done when: corrections tests cover every function incl. undo order, removing then restoring, deleting an added box, box clamped at the image edge, payload skips failed/unedited photos, `correctedCount` = count - removed + added; PhotoViewer test: N pipes -> N rects with the right classes, clicking a rect calls `onPick` with that box's centre (helper mocked), `view="crop"` sets viewBox to the crop box.

**Accepted deviations (8a)** (tester + reviewer PASS 2026-11-09, 0 fix loops):
- Boxes are not keyboard-focusable (design spec flag 7); Undo + the Actual field are the keyboard path.
- Callback named `onPick`; `toImagePoint` converts via the SVG bounding rect (not `getScreenCTM`).
- `DEFAULT_BOX_FRACTION` 8 % and `CROP_PAD_FRACTION` 3 % are marked `TODO(contract)`.
- In crop view, taps outside the pipe area still add boxes (accepted).

8b. [x] **Result page: viewer card** | files: `web/src/pages/Result.tsx` (left side), `web/src/components/PhotoStrip.tsx` (new), `web/src/lib/annotate.ts`, `web/src/lib/annotate.test.ts`, `web/src/pages/Result.test.tsx`, `web/src/lib/i18n.ts`; delete `components/ResultCard.tsx` | reuse: PhotoViewer + corrections lib (8a), session `removePhoto`, `downloadBlob`, `meanConfidence` | details: per spec section 5: header (Back to processing ghost -> `/processing`, keeps session; H1; batch chip `Batch 3f9c…a21e · draft`); toolbar (file name, "Photo 1 of 4", 28 px count chip = corrected count, amber "to check N" chip, Pipe area / Full photo segmented toggle, default Pipe area); help row + Undo; legend; actions Save original (original file) / Save result PNG (corrected boxes on the upload file: kept model boxes cyan/amber, added green, removed skipped) / Remove photo (disabled when 1 left); strip with crop thumbs, count chip, green pencil badge when edited, failed tint + chip, selected = cyan ring + `aria-pressed`. Failed photo: dimmed photo + reason + "Not counted in the totals", count/toggle hidden, Save result disabled. | done when: Result test (session seeded with 2 photos, 1 failed): clicking a model box drops the toolbar count by 1 and shows the strip pencil badge; Undo restores it; clicking empty space (helper mocked) adds 1; Remove photo is disabled with 1 photo left; failed photo hides the count chip; annotate test: `drawBoxes` strokes kept + added boxes only, in the new token colours.

**Accepted deviations (8b)** (tester + reviewer PASS 2026-11-09, after 1 fix loop):
- Pipe area / Full photo = two `aria-pressed` buttons, not shadcn ToggleGroup (no new dep).
- 2-step flow also shown in the Result header (keep or remove decided in 11).
- `width` / `height` added to `SessionPhoto` via compress (both branches).
- Deleted `BoxOverlay`, `ResultCard`, `StepCard`, `Stepper`.

8c. [x] **Result page: count + confirm panel, submit, toast, cancel** | files: `web/src/components/ConfirmForm.tsx`, `web/src/components/CountSummary.tsx` (new), `web/src/components/Toast.tsx` (new), `web/src/lib/api.ts` (`ConfirmInput.corrections` -> `corrections[]` in the body), `web/src/lib/api.test.ts`, `web/src/pages/Result.tsx` (right panel), `web/src/pages/Processing.tsx` (show toast from `lastSavedDo`), `web/src/pages/Result.test.tsx` | reuse: `lib/confirm.ts` (`validateConfirm`, `parseActual`, `variance`, `formatVariance`, MAX_DO / MAX_NOTES), corrections `totals()` + `toCorrections()`, existing ConfirmForm submit-lock (`inFlight`) and error handling | details: 03 COUNT: model total -> corrected total (cyan), "-1 removed / +3 added" chips or "No corrections yet", mean confidence meter, low-conf count, photos counted 3/4 + failed chip, per-photo `44 -> 45` list. 04 CONFIRM: DO (mono, max 64), Actual stepper [-][input][+] 52 px that follows the corrected total until the user edits it, variance badge vs **model** total (green match / amber `+2 vs model` + "this batch will be flagged"), helper "Defaults to the corrected total (122)" / "Differs from the corrected total", Notes with `0/2000` counter, Submit disabled until valid with helper saying what is missing, Cancel (red outline) -> alertdialog, No focused, Esc = No; Yes = `clear()` + `/processing`. Submit: spinner, fields + viewer locked; success -> `setLastSavedDo(do)` + `clear()` + `/processing`; Processing shows the green toast top-right (X, auto-hide ~5 s, then `setLastSavedDo(null)`); error -> alert, all kept, button "ลองส่งใหม่ Try again". | done when: api test: `confirmBatch` body has `corrections` and `image_ids`; Result test: after removing 1 box Actual shows corrected total, typing in Actual stops it following, variance badge shows "+2 vs model" for model 120 / actual 122; submit sends batch id, kept image ids and the corrections payload, then Processing shows the toast with the DO number; a rejected submit shows the alert and keeps the DO/notes text; Esc in the cancel dialog keeps the session.

**Accepted deviations (8c)** (tester + reviewer PASS 2026-11-09, after 1 fix loop):
- Hand-rolled `ConfirmDialog` + `Toast` (no shadcn AlertDialog / sonner deps).
- Totals live inside `ConfirmPanel`; no separate `CountSummary` component.
- `image_ids` includes failed photos; `corrections` never do.
- "Back to review" banner + Detect-confirm on Processing added here, so edits are protected even if 8d is cut.

8d. [ ] **NOT BUILT: cut, pending Tang's OK (Back keeps photos + box edits and shows "Back to review"; typed DO/Notes/Actual are lost on Back). Back to processing: add photos, re-detect, keep corrections (cuttable, fallback above)** | files: `web/src/lib/corrections.ts` (`rebaseEdits(oldPipes, newPipes, edits) -> { edits, lost }`), `web/src/lib/corrections.test.ts`, `web/src/pages/Processing.tsx`, `web/src/pages/Processing.test.tsx`, `web/src/pages/Result.tsx` (lost-corrections warning) | reuse: Processing detect path (6a), session `start()`, `toDetectedImages` | details: with a session, Processing shows kept photos as done rows (count = corrected count, edited badge) above any new rows. CTA: no new rows -> "ไปตรวจผล · Back to review" (navigate, no upload); new rows -> "ตรวจจับ N รูป". Detect = upload kept `upload` files + new ready files in one request -> new batch -> for kept photos `rebaseEdits` by matching boxes -> `start(newBatchId, photos)` with remapped edits. Removing a kept row removes it from the session and drops its edits. Max 10 counts kept + new. | done when: rebase tests: identical pipes -> same edits; pipes reordered -> removed indices follow the boxes; a removed box that is gone -> dropped and `lost = 1`; added boxes unchanged. Processing test: session photo A with 1 removed + 1 added, add photo B, mocked upload returns A's same pipes -> new session has the new batch id, A's corrected count unchanged, B present.
- **Leftovers assigned to 8d (2026-11-09):** form draft (DO / Notes / typed Actual) kept in the session across Back; lock header Back, strip and view toggle while submitting; dialog: a non-button mousedown inside the dialog keeps focus; convert the Processing auto-navigate tests (`Processing.test.tsx` ~268, ~457) to fake timers.

10a. [x] **Dashboard: KPIs + Recent 10 + states** | files: `web/src/pages/Dashboard.tsx`, `web/src/pages/Dashboard.test.tsx`, `web/src/lib/api.ts` (drop `listAllRecords`, `getRecordCounts`, `EXPORT_CAP`, `getCountsTotal` if unused), `web/src/lib/api.test.ts`, `web/src/lib/i18n.ts`; delete `pages/Records.tsx`, `pages/Records.test.tsx`, `lib/csv.ts`, `lib/csv.test.ts` (nothing else uses them after 3a/3b) | reuse: `getStats`, `listRecords({ limit: 10 })`, `ratePct`, `formatVariance`, refresh/updated-at pattern already in `Dashboard.tsx`, row formatting from `Records.tsx` (time, status/flagged chip) before deleting it | details: header actions (Updated hh:mm, Refresh, New detection hidden on phone); 4 KPI cards (icon tile, 44 px mono value, footnote; correction rate meter, `null` -> "—" + "Nothing confirmed yet"; failed tile red when > 0); Recent 10 table (Time, DO, Operator, Photos, Model, Actual, Variance, Status chip Confirmed / Flagged / Draft, draft "—"), cards on phone; empty state (KPIs 0/0/—/0, "No records yet", big New detection button), loading skeleton + Refresh spinner, API error alert + Retry with KPIs "—" and lists hidden. | done when: Dashboard test: mocked stats + 3 records render 4 KPI values and 3 rows with the right status chips; all-zero + no records shows the empty state; a rejected `getStats` shows the error alert and Retry refetches; `grep -rnE "pages/Records|lib/csv" web/src` finds nothing; `npm run build` passes.
- **Leftovers assigned to 10a (2026-11-09):** toast token + mono DO + EN "Ready for the next batch."; stack Submit label TH/EN; remove the `outline` button variant + unused old i18n keys; Dashboard `gray-*` / `blue-*` classes; `uploadImages` uses `errorText()` and a network `TypeError` -> "เชื่อมต่อ API ไม่ได้ / Can't reach the API" (moved from 6c); shared `BrandMark` (from 4) if time, else 11.

**Accepted deviations (10a)** (tester + reviewer PASS 2026-11-09, 0 fix loops):
- Toolbar (Updated, Refresh, New detection) sits in a page row, not the AppShell header (needs a header slot -> 11).
- API chip follows `/health` only.
- Time format: hh:mm for today, dd/mm hh:mm for older rows (browser timezone).
- Variance uses ASCII "-".
- Records page, CSV export and filters deleted (Tang chose Recent 10).
- Shared `BrandMark` done here (removed from 11's list).
- `outline` button variant and 32 unused i18n keys removed.

10b. [x] **Dashboard: 4 charts (recharts)** | files: `web/package.json` (`npm i recharts`), `web/src/lib/api.ts` (`getDailyStats(days = 7)` adapter -> `{ date, detections, pipesActual, correctionRate }[]`), `web/src/lib/api.test.ts`, `web/src/lib/chart-data.ts` (new, pure: Thai day tick `อ. / 10/11`, today flag, 7-day totals, model-vs-actual rows with signed variance), `web/src/lib/chart-data.test.ts` (write first), `web/src/components/DashboardCharts.tsx` (new, 4 chart cards), `web/src/pages/Dashboard.tsx`, `web/src/test-setup.ts` (ResizeObserver stub if needed) | reuse: `listRecords({ filter: 'confirmed', limit: 10 })` for model vs actual, tokens `viz-1` / `viz-2` from 3a, `dataviz` skill | details: per spec section 6: detections/day bars (viz-1, 7-day total, only today's bar labelled), pipes/day bars (viz-2), correction-rate line (y 0-50 %, `null` = gap + note), model vs actual dot plot (hollow cyan ring vs violet square, connector when different, signed variance column). Each card: Thai title + English subtitle, 230 px chart, `<details>` "View as table", keyboard-focusable tooltip, today's tick bold. Charts hidden in the empty and error states. | done when: chart-data tests: 7 days in -> 7 ticks, last flagged today, Bangkok date strings not shifted by the browser timezone, `null` rate kept as `null`, variance sign correct; api test maps snake_case -> camelCase; Dashboard test: each of the 4 `<details>` tables has 7 / 7 / 7 / 10 rows from mocked data; manual: charts readable on the projector-like 1366 px view and in one column at 375 px.
**Accepted deviations (10b)** (tester FAIL -> 1 fix loop -> PASS; reviewer PASS 2026-11-09):
- Invisible `gap`/`edge` helper Lines give tooltips on null days / model-vs-actual; model-vs-actual not keyboard-focusable (`accessibilityLayer={false}`), the table fallback is the accessible path.
- Today's value label omitted when today's value is 0.
- `react-is@19.3.1` pinned (recharts resolved react-is 17).
- Charts grid breakpoint = `@min-[900px]` container query (2x2 at 1366).
- Charts only fetch when `data && !empty`.
- **From 10a (2026-11-09):** put the charts at the TODO in `Dashboard.tsx` (~line 301), rendered only when `data && !empty`.

11. [x] **Verify + log (scribe)** | files: `docs/requirements.md`, `docs/decisions.md`, `docs/problem-log.md`, copy previews to `Desktop/Capstone/` root | done when: full check list below passes; demo items 1-7 ticked only where tester + reviewer PASSed.
- **Leftovers assigned to 11 (2026-11-09):** horizontal-scroll re-check at 1366 / 375 px; icon / hex polish (PhotoRow raw hex, Login shadows, toast); Login polish (focus after Check again, EN "Sign in" size, full stops, `name` attrs, h2 -> p); queue `aria-live` only for done / failed; Result header 2-step flow: keep or remove.
- **Leftovers from 10a (2026-11-09):** phone card labels `font-sans` (`Dashboard.tsx:155`); stacked "Updated" TH/EN (`Dashboard.tsx:247`); network-error copy on two lines as in the preview; "DO number" casing (`i18n.ts:85`) and `colActual` "จริง" (`i18n.ts:104`); AppShell header slot for the page toolbar; API chip reacts to a failed dashboard fetch; today-KPI icon; `aria-live="polite"` on the updated/loading text; Toast mono highlight only covers the first DO occurrence.

**Task 11 PASS 2026-11-09** (tester PASS: vitest 197/197 x3, tsc/lint/build, api pytest 93). Polish A-H all done. Flaky tests fixed at root cause: CameraModal Tab-trap (focus effect racing the test's `.focus()`), Processing timing (real-time waits -> fake timers). Dashboard toolbar sits next to the title via Outlet-context slot `lib/shell-context.ts`; API chip updates at once on dashboard/upload failure; `ScanLens` icon; tokens `photo-bg`, `err-hi`, `ok-surface`. Final walkthrough PASS on the production build at 1366 + 375: no h-scroll, no console errors, fonts self-hosted, keyboard-only OK. Sizes: main 424.8 kB (128.9 gz), lazy charts chunk 396.1 kB (113 gz), CSS 114.7 kB.

Suggested schedule (weekdays 08:30-11:30, 14 blocks to 30 Nov): 10 Nov 3a · 11 Nov 3b · 12 Nov 4 · 13 Nov 6a · 16 Nov 6b · 17 Nov 8a · 18 Nov 8b · 19 Nov 8c · 20 Nov 8d · 23 Nov 10a · 24 Nov 10b · 25 Nov 6c or buffer · 26 Nov 11 · 27 Nov buffer / rehearsal.
Order: 3a -> 3b -> 4 -> 6a -> 6b -> 8a -> 8b -> 8c -> 8d -> 10a -> 10b -> (6c) -> 11. Task 4 and 10a only need 3a/3b, so they can move earlier if a Result task is blocked.

## Cut order if behind
From the master plan (in this order):
1. Pipe area / Full photo toggle (8b): keep the crop view only (P4 still met).
2. Correction-rate chart (10b).
3. Pipes counted/day chart (10b).
4. Live camera (6b): keep the `<input capture>` fallback.

Extra cuts proposed by the planner (need Tang's OK before using them):
5. Upload % (6c): keep the shared "Uploading & detecting…" phase.
6. Add photos after Back (8d): use the read-only fallback (no corrections lost).
7. Login illustration animation (4): static panel.

## OPEN
- Quality thresholds `DARK_LUMA 60 / BRIGHT_LUMA 200 / BLUR_VARIANCE 100` (`lib/quality.ts`) -> Tang tunes on real yard photos from `Tang/samples/`.
- `crop_box` source and box format (`[x,y,w,h]` px?) -> ask Game/Opor. Only `lib/detection.ts` changes.
- Added box shape/size: median box of that photo (circle `cx,cy,r` instead?) -> ask Game/Opor.
- Added-box size when a photo has 0 detected pipes (`DEFAULT_BOX_FRACTION`, proposal 8 % of the short side) -> ask Tang.
- Low-confidence threshold `LOW_CONFIDENCE = 0.5` -> ask Game/Opor.
- Real model determinism: will the same image give the same boxes? (8d matches boxes exact, then IoU >= 0.9) -> ask Game/Opor.
- Re-detect after Back leaves an extra draft batch. Want an API change instead (append photos to a draft batch, or delete a draft)? Not in this plan -> ask Tang.
- Demo device for the live camera: phone over plain `http://<laptop-ip>` has no `getUserMedia` (needs HTTPS), so it falls back to the native picker. OK, or set up HTTPS dev? -> ask Tang.
- `.claude/agents/designer.md` still says Figma is the source of truth (spec flag 10) -> Tang to update; not a coder task.

## Risks
- **Time:** 13 task blocks + 1 buffer in 14 blocks. 6a, 8b and 8c are the fullest; if any runs over a block, apply the cut order immediately instead of working evenings.
- **Real Supabase:** migrations `20261104_images_excluded.sql` and `20261109_pipes_position.sql` are not applied; without them every upload and confirm with `image_ids` fails. Apply before the first manual end-to-end run (3b), or test against the fake repo only.
- **Uncommitted work:** tasks 5/7/9 are not committed on `tang/dark-ui`. Commit before 3a so the theme change is a clean diff.
- **Half-dark app between tasks:** after 3a the old pages (Capture, Dashboard) still use `gray-*` classes on a dark background until their task. Demo only from the branch after 10a.
- **Box coordinates:** boxes are relative to the compressed upload. Using the original file in the viewer would misplace every box on photos larger than 2048 px.
- **jsdom limits:** no `getScreenCTM`, `createImageBitmap`, `getUserMedia` or `ResizeObserver`. Keep those behind small helpers and mock them; prove the real behaviour by the manual checks.
- **recharts + React 19 / jsdom:** charts may render 0 px wide in tests. Test the data and the `<details>` tables, not the SVG.
- **HEIC photos from iPhones:** desktop Chrome cannot decode them; they show "Can't read this photo". Tell the demo audience to use JPEG, or take photos with the camera modal.

## Backlog / known gaps (2026-11-09)
- Page `<title>` per route (`index.html:6`).
- API chip stays offline after a successful Dashboard Retry until the next 30 s poll (`Dashboard.tsx` ~261): call recheck on success too.
- Result form draft (DO / Notes / Actual) not kept across Back (8d cut).
- Today's bar label hidden when value is 0.
- Login copy: one second line may still need a full stop (coder could only identify `demoLogin.en`).
- OPEN with ML team: quality thresholds, `crop_box`, box format.
- Supabase migrations NOT APPLIED.
- Live camera on phone over plain http falls back to the native picker (HTTPS decision pending).
- Manual run against real Supabase not done.

## Final verification (task 11)
- `cd Tang/web && npm run test && npx tsc -b && npm run lint && npm run build`; `cd Tang/api && pytest && ruff check .`
- Manual, API running (`uvicorn app.main:app --reload`) + `npm run dev`: Login -> Processing (camera 1 shot + 3 files, one dark) -> Result (remove 1 box, add 1, change photo, Save result PNG) -> Back -> add 1 photo -> detect -> corrections still there -> Submit -> toast on Processing -> Dashboard shows the new row in Recent 10 and charts updated.
- Same walk at 1366 px and 375 px; API stopped: Login warns but signs in, Processing shows the API error banner with photos kept, Dashboard shows the error state; DevTools Offline: fonts still load.
