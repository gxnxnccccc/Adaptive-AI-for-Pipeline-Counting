# Problem log (for the final report, professor request P7)

One row per problem. Write it the same day. Keep the "Why it happened" honest, the report needs it.

| Date | Area | Problem | Why it happened | Fix / workaround | Status |
|---|---|---|---|---|---|
| 2026-11-10 | docker | Docker images were never built or run | Docker is not installed on Tang's PC | Verified by reading the files and running the same steps outside Docker (empty `VITE_API_URL` bundle, DEMO_MEMORY API, browser walk at 1366 + 375). Tang or a friend must run `docker compose up --build` once | open |
| 2026-11-09 | api | A JSON body with NaN/Infinity returned 500 instead of 422. Found while adding FiniteFloat box validation (task 7) | FastAPI's default 422 handler echoes the input back and can't JSON-encode non-finite numbers, so the handler itself crashed | Custom `RequestValidationError` handler in `api/app/main.py` converts non-finite numbers to strings, response stays 422 | fixed |
| 2026-11-09 | web / process | `tsc -b` broke in another task's files mid-run while two coders worked in parallel | Both touched a shared type (`Compressed` / `SessionPhoto` gained `width` / `height`) | Gave the type change to the 8b coder only. Rule: only one coder at a time touches shared session/photo types | fixed |
| 2026-11-09 | web | Result PNG strokes were always 2 px | `annotate.ts` read `bmp.width` after `bmp.close()`, which returns 0 | Stroke width now from `canvas.width` + regression test. Found by the tester measuring the PNG | fixed |
| 2026-11-09 | web | 104 px desktop thumbnail never applied | Tailwind v4 emitted `sm:` after `min-[1100px]:`, so `sm:` won | Used `min-[640px]:` instead of `sm:` | fixed |
| 2026-11-09 | web | Page 1581 px wide at 1366 px (horizontal scroll) | Old `ConfirmForm` overflowed the new 400 px right column | Replaced in task 8c | fixed |
| 2026-11-09 | web / tests | Processing auto-navigate test flaked 1 in 5 full runs under load | Real 1.5 s wait with a 3 s real-time timeout | Convert to fake timers in task 8d | open |
| 2026-11-09 | process | Two coders stopped mid-task | Claude 5-hour usage limit hit | Resumed from saved state, no work lost | fixed |
| 2026-11-09 | process | A coder staged a deletion (`git rm --cached`), then undid it | Agent ran git staging it shouldn't | Undone. Rule: agents don't stage; Tang runs git | fixed |
| 2026-11-09 | process | A coder's dev server (`vite --port 5199`) was left running after its check | Agent didn't stop the server it started | Stopped. Rule: agents stop any server they start | fixed |
| 2026-11-09 | web | recharts pulled `react-is` 17, breaking React 19 element detection | recharts' transitive dep not compatible with React 19 | Pinned `react-is@19.3.1` | fixed |
| 2026-11-09 | web | Today's chart value label vanished when an earlier day had 0 | Recharts drops zero bars from the label index; label was looked up by index | Look up by value; regression test added. Tester caught it in the browser, unit tests missed it | fixed |
| 2026-11-09 | web / tests | Flaky tests: CameraModal Tab-trap and Processing auto-navigate | Focus effect racing the test's `.focus()`; real-time waits | Fixed at root cause (focus wait; fake timers); 6 consecutive green runs | fixed |
| 2026-11-09 | process | Dev servers left running (port 5199 x2, from the 8c coder) | Agents did not stop servers they started; sandbox denied killing them | Tang must stop the PIDs manually | open |
