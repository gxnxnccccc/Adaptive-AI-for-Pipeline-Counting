# web/
Vite + React + TypeScript + Tailwind. Run: see [../README.md](../README.md).

- Everything goes through the API. No Supabase client here.
- `src/lib/detection.ts` is the only file that reads raw model/API fields. If the ML format changes, change that file.
- `src/lib/api-types.ts` is generated: `npm run gen:types` (API must be running on :8000).
- Pages: `Login`, `NewDetection` (steps 1-3 + success), `Records`, `Dashboard`.
- Labels are Thai + English (`src/lib/i18n.ts`).
- Function first: the visual design is not final (Figma is a reference only, see `../docs/design/`).
- Tests: `npx vitest run`. Checks: `npx tsc -b --noEmit`, `npm run lint`, `npm run build`.
