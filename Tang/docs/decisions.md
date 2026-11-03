# Decisions log

One line per decision: date | decision | why | status (proposed / agreed by Tang / agreed by team)

- 2026-11-02 | Dev pipeline = planner -> coder -> tester -> reviewer -> scribe, main session = orchestrator | small gated steps, problem log stays current | agreed (Tang)
- 2026-11-02 | Mock detector behind adapters (`web/src/lib/detection.ts`, `api/app/detector.py`) until the real model exists | Tang isn't blocked by the ML timeline (model = Dec-Jan) | agreed (Tang)
- 2026-11-03 | Tang's scope = web app + API; Guy builds React Native on the same API | least overlap, matches roles | agreed (Tang), confirm with team
- 2026-11-03 | API = FastAPI (Python) | same language as the model team | agreed (Tang), tell Hymn
- 2026-11-03 | Web = Vite + React + TypeScript + Tailwind | fast demo, phone-browser friendly | agreed (Tang)
- 2026-11-03 | Tang's work lives in `Tang/` in the team repo; branch `tang/<feature>` + PR to `main`, 1 review | team can see his work, no conflicts with others | agreed (Tang)
- 2026-11-03 | DB + image storage = Supabase (Postgres + private Storage bucket), accessed only from FastAPI | one service, real SQL, dashboard for the professor | agreed (Tang), confirm owner with Hymn
- 2026-11-03 | UI design = Figma, `designer` agent turns frames into `docs/design/<screen>.md` | design before code, shared look with Guy's RN app | agreed (Tang)
- 2026-11-03 | Skill route = karpathy always; ui-ux-pro-max + shadcn + web-design-guidelines for UI; systematic-debugging for bugs; TDD only for count logic/compression/adapter; slides + weekly doc via Claude app artifacts | light strictness fits 3.5 h/day, clean UI fits a warehouse tool | agreed (Tang), see docs/skill-routes.md
- 2026-11-03 | Claude setup: Claude Code on laptop inside `Tang/` + Claude app Project "SPDS Capstone" | Tang's chosen tools | agreed (Tang)
