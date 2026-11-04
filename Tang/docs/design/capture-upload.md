# Screen: Capture / Upload (Step 1 of 3)   Figma: https://www.figma.com/make/Fcwtli6ARlTTlMDXUnowlj/Steel-Pipe-Detector-UI-Design   Requirement: Demo item 1 (P3), 6 (P1), 7 (P5)

> **Status: REFERENCE, not final design** (decision 2026-11-04). Take colors, buttons and cards from here; the real layout is designed in code, mobile-first, Thai + English, and must cover everything under MISSING IN FIGMA. No Figma update is needed first.

Source: Figma Make `src/app/components/Dashboard.tsx`, column 1 (route `/dashboard`). Desktop web only (`max-w-[1600px]`, `grid-cols-3`). The design shows **one image only**.

## Layout (top -> bottom)
Page shell (shared by all 3 steps): `min-h-screen bg-gray-50`; header `bg-white border-b border-gray-200 shadow-sm`, inner `max-w-[1600px] mx-auto px-6 py-4`; title "Steel Pipe Detector" `text-2xl font-bold text-blue-700` + "(Prototype)" `text-sm text-gray-500`; right side: "API Connected" (Wifi `text-green-600`), "Camera Ready" (Camera `text-green-600`), Logout button. Main `max-w-[1600px] mx-auto px-6 py-8`, `grid grid-cols-3 gap-6`.

Step 1 card: `bg-white rounded-2xl shadow-md p-6`
- Card header (`flex items-center gap-3 mb-6`): number badge "1" `w-8 h-8 bg-blue-600 text-white rounded-full font-bold`, title "Capture / Upload Image" `text-xl font-bold text-gray-800`.
- **State idle** (`space-y-4`):
  - Drop zone `<label>`: `border-2 border-dashed border-gray-300 rounded-xl p-12 text-center`; hover `hover:border-blue-500 hover:bg-blue-50`, `cursor-pointer transition-all`. Upload icon `w-12 h-12 text-gray-400`, "Click to upload image" `text-gray-600 font-medium`, "or drag and drop" `text-sm text-gray-500`. Hidden `<input type="file" accept="image/*">`.
  - Divider: line `border-t border-gray-300` with "or" `px-2 bg-white text-sm text-gray-500` centered.
  - "Capture from Camera" button: `w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg`, Camera icon `w-5 h-5`, `gap-2`.
- **State imageLoaded** (`space-y-4`):
  - Preview: `rounded-xl overflow-hidden border-2 border-gray-200`, `<img class="w-full h-64 object-cover">`.
  - "Remove Image": `w-full py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50`.

Colors map cleanly to Tailwind defaults (blue-600 #2563EB, gray-50/100/300/500/600/700/800). Font family: see Figma `src/styles/theme.css` / `fonts.css` (not read; check before coding).

## Components to build/reuse
- `StepCard`: props `step: number`, `title: string`, `active: boolean`, `children`. Badge is `bg-blue-600` when active, `bg-gray-300` when not (steps 2-3 use this). Reuse for all 3 columns.
- `DropZone`: props `onFiles(files: File[])`, `disabled?`. Dashed zone + hidden input. Needs real drag-and-drop handlers (Figma only shows the text).
- `CameraButton`: props `onClick`. Figma button has no behavior.
- `ImagePreview`: props `src`, `alt`, `onRemove`. Per-image status goes here once multi-image exists (see MISSING).
- Use shadcn `button` (Figma Make ships `ui/button.tsx`) rather than raw `<button>` where the variants fit.

## Interactions
- Click drop zone -> OS file picker (`image/*`) -> first file read as data URL -> state `imageLoaded`.
- Drag file onto zone -> text promises it, Figma has no handler. Build it.
- Click "Capture from Camera" -> **nothing in Figma** (placeholder).
- Click "Remove Image" -> resets the **whole workflow** (`handleReset` clears results, DO number, notes), not just the image.
- After `imageLoaded`, step 2 shows "Run Detection". Upload itself does not start detection.

## Data needed from API
- Nothing at upload time in Figma (detection is a separate button, 3 s mock timer).
- For demo scope: `POST /api/counts` multipart `images[]` (see `docs/api-contract.md`, DRAFT, not confirmed by ML).
- `quality.brightness`, `quality.blur` for guidance v1: proposed in contract, **OPEN** (ML not confirmed). Brightness/blur check before upload can run client-side instead.
- `stored_bytes` / `original_bytes` for compression v1 display: proposed, **OPEN**.

## MISSING IN FIGMA
- **Multiple images (P3, demo item 1):** the design takes a single file. Needs: a multi-select picker, thumbnail grid/list, per-image status (queued / uploading / done / failed), per-image remove, add-more.
- **Pre-capture guidance (P1, demo item 6):** nothing for "move closer / too dark / too bright / blurry / something blocking the camera".
- **Compression info (P5, demo item 7):** no place for original vs compressed size.
- **Camera capture:** no camera view, permission prompt, denied-permission state, or "no camera found" state. The header "Camera Ready" has no failed state either.
- **Upload errors:** wrong file type, file too large, read failure, API down ("API Connected" has no offline variant).
- **Drag-over state** (only hover is styled), focus-visible state, disabled state during detection.
- **Loading state while reading/compressing a large photo.**
- **Cropped pipe-only area (P4):** belongs to the result screen, but the Step 1 preview does not show it either.
- **Thai text:** no Thai strings in design; all copy is English.
- **Mobile/tablet layout:** desktop only; the React Native app (Guy) is a separate design.

## Flags
- Touch targets: drop zone, "Capture from Camera" (`py-3` + 20px icon ≈ 44px, borderline) and "Remove Image" (`py-3` ≈ 48px) pass. Header **Logout `py-2` ≈ 40px** is under 44px (outside this card, same page).
- "Remove Image" wipes everything in steps 2-3 with no confirm. Risky once the user has typed notes; add confirm or limit the reset to the image.
- Contrast: `text-gray-500` on white (≈ 4.8:1) is OK for 14px; `text-gray-400` icon on white is decorative only. The "or" label `text-gray-500` on white passes.
- Drop zone is a `<label>` wrapping a hidden input: keyboard users can tab to it only if the input stays focusable (use `sr-only`, not `hidden`) and a visible focus ring is added.
- `object-cover` with fixed `h-64` crops the photo; pipes at the edge may look missing. Prefer `object-contain` for the preview, or confirm with Figma.
- Step 1 is the only enabled step in the prototype's flow; the badge colors (blue vs gray-300 with white text, ≈ 1.5:1) for inactive steps fail contrast. Check against designer intent.
- Figma prototype is desktop-only and one image; the demo needs multi-image. Ask Tang whether Figma should be updated first, or the coder follows this spec's MISSING list.
