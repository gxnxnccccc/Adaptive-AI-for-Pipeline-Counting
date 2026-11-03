# AGENTS.md: Tang's AI team for SPDS

Built from an interview with Tang on 3 Nov 2026:
- Scope: web app + FastAPI backend (Guy does React Native on the same API)
- Users: Tang only (teammates can copy it later)
- Claude tools: Claude Code on laptop, Claude app chat, Claude Projects
- Repo: team GitHub repo, Tang works only in `Tang/`, branch + PR to `main`
- Stack: Figma (design), Vite + React + TS (web), FastAPI (API), Supabase (DB + images). Details: `docs/tech-stack.md`

## 1. The team (Claude Code subagents, `.claude/agents/`)
Based on the "studio pipeline" picture, cut down to what a solo dev with 3.5 h/day can run.

| Agent | Studio role | Job | Hard rule | Model |
|---|---|---|---|---|
| Orchestrator (main session) | Claudy | Routes every task, keeps the loop moving | Never writes code | your default |
| `designer` | Minnie (ideas -> shape) | Figma frame -> `docs/design/<screen>.md` spec | Never writes code; missing states listed, not invented | sonnet |
| `planner` | Reece | Feature -> 3-7 small tasks with checkable done-criteria | Never writes app code; blocks out-of-scope work | sonnet |
| `coder` | Rae | Builds ONE task in `web/` or `api/` | Only inside `Tang/`; model output only via the adapter; no git push | sonnet |
| `tester` | Chris (reality tester) | Runs typecheck/build/pytest, adds tests | No command output = FAIL; edits tests only | sonnet |
| `reviewer` | Vera + Devil (facts gate + perspective) | Final PASS/FAIL gate | Read-only; re-runs claims; folder rule | sonnet |
| `scribe` | Libby / Indie (knowledge) | Problem log, decisions, requirement ticks, weekly review | Only edits `docs/`; logs only what happened | haiku |

Flow:
```
Tang -> Orchestrator -> [designer, new screens only] -> planner -> coder -> tester -> reviewer -> scribe
                                                                   ^         |FAIL      |FAIL
                                                                   └─────────┴──────────┘  (max 3 loops, then ask Tang)
```

Why only 6 (not 14 like the picture): every extra agent costs time to maintain and tokens to run. Add one only when a job repeats every week and the current 5 do it badly. Candidate later: `bench` (SSIM/PSNR compression benchmark for the report).

## 2. Skill routes (which Claude feature for which job)

**Which Claude *skills* (karpathy, shadcn, systematic-debugging...) go with which job: see `docs/skill-routes.md`.** The tables below are about which Claude *tool* (Claude Code vs app) to use.

### A. Claude Code (laptop, inside `Tang/`): all work on real files
| Need | Route | Example prompt |
|---|---|---|
| Start a work block | `/start-block` skill | `/start-block` |
| New screen from Figma | `designer` first | "Use designer on <Figma link>: Result screen" |
| New feature | Orchestrator -> planner -> ... | "Act as orchestrator. Feature: demo item 1. Run planner first." |
| Small fix (1 file) | `coder` directly, then `tester` | "Use coder: fix the count not updating after remove" |
| Bug you don't understand | ask for root cause first, no fix yet | "Find the root cause of X. Don't change code yet." |
| Something broke | `/log-problem` skill | `/log-problem upload fails for HEIC photos` |
| End a work block | `/end-block` skill | `/end-block` (commit message + PR text, you run git) |
| Sunday review | `scribe` | "Run scribe: weekly review" |
| Read docs of a library | ask Claude Code to look it up on the web | "Check current FastAPI docs for UploadFile with multiple files" |

### B. Claude app, inside the "SPDS Capstone" Project: thinking, writing, people
| Need | Route |
|---|---|
| Architecture / stack choice | Project chat "Tech decisions" (options + tradeoffs, then you decide) |
| Learn a concept (FastAPI, React state, SSIM) | Project chat "Learning" (hint first) |
| Message to team / professor | Project chat "Team comms" |
| Weekly plan vs calendar | Project chat "Weekly review" (Claude can read your Google Calendar) |
| Report chapters, problem section | Docs artifact, fed from `docs/problem-log.md` + `decisions.md` |
| Presentation | Slides artifact |
| Diagrams (architecture, flow) | Whiteboard artifact or inline diagram |

### C. Connectors worth using
| Connector | Use |
|---|---|
| Google Calendar | check blocks, move them when camp/competition dates arrive |
| Google Drive | read the team Plan sheet + professor update doc |
| Supabase | Claude Code (Supabase MCP) can list tables, apply migrations, read logs. Always on a dev project/branch first, never paste the service-role key into chat |
| Figma | Claude Code (Figma MCP server, if you connect it) reads frames for `designer`; otherwise export PNGs to `docs/design/img/` |
| GitHub | read teammates' PRs/folders (Claude Code uses `git`/`gh` on your laptop) |

## 3. Rules every agent follows
1. Only `Tang/`. 2. No guessing ML fields (OPEN). 3. No claim without a command. 4. Every problem logged. 5. Before 30 Nov: demo scope only. 6. Tang does git push/PR.
