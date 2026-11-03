# CLAUDE.md: how to work in Tang/ (SPDS capstone)

Read this first, every session. Short version: **pull, branch, plan, build one task, test, review, log, commit, PR. Only inside `Tang/`.**

## 1. Project in 5 lines
- User photographs stacked round steel pipes -> system counts them -> user fixes the count -> confirmed count is saved (company DB later).
- Team repo: https://github.com/gxnxnccccc/Adaptive-AI-for-Pipeline-Counting (shared by 5 people).
- Tang = Fullstack Dev: **web app (`web/`) + FastAPI backend (`api/`)**, designed in Figma, data in Supabase. Guy builds the React Native app on the same API. Game/Opor/Hymn own the model.
- Until the real model exists, the API uses a mock detector.
- Self demo **30 Nov 2026**. Team finalize Mar-Apr 2027.

## 2. Folder map (you may only write inside `Tang/`)
```
repo root/                 <- other teammates' folders live here. NEVER edit them.
└── Tang/                  <- open Claude Code HERE (so .claude/ below is loaded)
    ├── CLAUDE.md          <- this file
    ├── AGENTS.md          <- who does what (agents + skills)
    ├── .claude/agents/    <- planner, coder, tester, reviewer, scribe
    ├── .claude/skills/    <- /start-block, /end-block, /log-problem
    ├── web/               <- Vite + React + TS + Tailwind
    ├── api/               <- FastAPI (Python); api/.env = Supabase keys (gitignored)
    │   └── supabase/migrations/  <- every DB change as a SQL file
    └── docs/
        ├── requirements.md   <- what to build + demo scope (source of truth)
        ├── api-contract.md   <- request/response shapes, OPEN fields
        ├── tech-stack.md     <- stack + why
        ├── decisions.md      <- one line per decision
        ├── problem-log.md    <- every problem, for the report
        ├── claude-workflow.md<- which Claude chat for what
        ├── design/           <- designer output from Figma (+ img/ exports)
        ├── plans/            <- planner output, one file per feature
        └── weekly/           <- Sunday reviews
```
Where updates go:
| Something happened | Update |
|---|---|
| Figma screen designed/changed | `docs/design/<screen>.md` (designer) |
| DB table/bucket change | `api/supabase/migrations/<timestamp>_<name>.sql` |
| New feature planned | `docs/plans/<feature>.md` |
| A choice was made (lib, format, scope) | `docs/decisions.md` |
| Anything broke or took > 30 min | `docs/problem-log.md` |
| Requirement finished (reviewer PASS) | tick it in `docs/requirements.md` |
| ML team answered a question | `docs/api-contract.md` (OPEN -> CONFIRMED) |
| Stack changed | `docs/tech-stack.md` + a line in `decisions.md` |

## 3. Git rules (team repo, branch + PR)
Start of every block:
```bash
git checkout main && git pull origin main
git checkout -b tang/<short-feature>      # e.g. tang/multi-upload
```
While working: small commits, only files under `Tang/`.
```bash
git add Tang/
git commit -m "web: multi-image picker with per-image status"   # prefix: web: / api: / docs:
```
End of block:
```bash
git pull --rebase origin main     # get teammates' changes first
git push -u origin tang/<short-feature>
```
Then open a PR to `main` on GitHub, ask 1 teammate to review, merge after approval. Delete the branch after merge.

Never:
- push directly to `main`, force-push a shared branch, or commit outside `Tang/`
- commit `.env`, API keys (especially `SUPABASE_SERVICE_ROLE_KEY`), `node_modules/`, `__pycache__/`, `.venv/`, or test photos (put photos in `Tang/samples/`, it's gitignored)

Claude (any agent) does NOT push, merge or open PRs. It may suggest the commands; Tang runs them.

## 4. Orchestrator rules (main Claude Code session)
You never write app code yourself. Route every task:
0. `designer` -> `docs/design/<screen>.md` (only for new/changed Figma screens)
1. `planner` -> `docs/plans/<feature>.md` (skip for one-file fixes)
2. `coder` -> ONE task
3. `tester` -> checks + tests
4. `reviewer` -> PASS/FAIL
5. `scribe` -> decisions, problem log, requirement ticks

- FAIL -> exact failure list back to `coder`. Max 3 loops, then stop and ask Tang.
- Done = tester PASS + reviewer PASS + scribe logged it.
- Unknown from ML team -> OPEN in `docs/api-contract.md`, code behind the adapter, ask Tang. Never guess.
- Before 30 Nov: only "Demo scope" items in `docs/requirements.md`. Everything else -> backlog.

## 4b. Skills
Full route: `docs/skill-routes.md`. Always: `karpathy-guidelines` when coding. UI: `ui-ux-pro-max` + `shadcn`, reviewed with `web-design-guidelines`. Bugs: `systematic-debugging`. Test-first (`test-driven-development`) only for count logic, compression, adapter. Slides + weekly doc: Claude app artifacts, not Claude Code.

## 5. How to talk to Tang
- Start with TL;DR. Short. Tables over paragraphs. Thai if he writes Thai.
- Report: done / blocked / next. Don't claim it works unless a command proved it.
- He's learning FastAPI/React: when he asks "how/why", give a hint first, then the answer if he asks again.

## 6. Working time
Weekdays 08:30-11:30. Sunday 10:30-11:30 = weekly review (`scribe`). Don't push work into evenings; if the plan doesn't fit, cut scope.
