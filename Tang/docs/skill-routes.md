# Skill routes: which Claude skill for which job

Built from interview 3 Nov 2026. Choices: jobs = **UI + debug/test**, deliverables = **demo slides + weekly progress doc**, UI style = **clean + functional**, strictness = **light**.

TL;DR: **karpathy-guidelines always on when coding. UI = ui-ux-pro-max + shadcn, checked by web-design-guidelines. Bugs = systematic-debugging. Tests-first only for the count logic. Slides + weekly doc go through the Claude app.**

Skill names below are the ones installed in the Claude session where this was written. Skills only exist where they're installed. Check on your laptop: open Claude Code in `Tang/`, run `/skills`. Any name missing -> say so in the next chat, I'll adapt the route (or you install it).

## 1. Always on (every coding task)
| Skill | What it does for us | Who |
|---|---|---|
| `karpathy-guidelines` | small surgical changes, state assumptions, define how we'll verify | `coder` (and orchestrator) |

## 2. Route table
| Job | Skills (in order) | Agent | Notes |
|---|---|---|---|
| New feature, unclear requirement | `brainstorming` -> planner | orchestrator -> `planner` | only when you're not sure what to build. Skip for demo-scope items already in `requirements.md` |
| New screen from Figma | `ui-ux-pro-max` (layout/interaction/accessibility) -> spec in `docs/design/` | `designer` | Figma wins on how it looks. The skill checks usability gaps (touch size, states) |
| Build UI components | `shadcn` (components, Tailwind) + `karpathy-guidelines` | `coder` | prefer shadcn components over hand-rolled ones; needs `components.json` in `web/` (coder sets up in M2) |
| Review UI | `web-design-guidelines` | `reviewer` | accessibility + UX check on the changed files |
| Bug / failing test / weird behaviour | `systematic-debugging` (root cause first, no fix yet) | orchestrator -> `coder` | write the cause in `problem-log.md` via `/log-problem` |
| Count logic, compression, API adapter | `test-driven-development` (test first) | `tester` writes test, `coder` makes it pass | **only these 3 areas.** Rest of the UI: tests after |
| Weekly progress doc | Claude app -> **Docs** artifact, source = `docs/weekly/*.md` + `problem-log.md` | scribe writes the weekly note, Claude app formats it | one page: done / blocked / next / problems |
| Demo slides (30 Nov + final) | Claude app -> **Slides** artifact | n/a (app, not Claude Code) | use `.pptx` skill only if someone demands a PowerPoint file |
| Data charts for the report (SSIM/PSNR, count accuracy) | `dataviz` | orchestrator | after M5 (compression benchmark) |

## 3. Not used (on purpose)
| Skill | Why not |
|---|---|
| `frontend-design`, `design-taste-frontend` | you chose clean + functional, and Figma sets the look. Revisit only for the final presentation visuals |
| `ponytail`, `caveman` | too minimal for work that goes into a graded project |
| `deep-research` | add later if the "study case" (P6) needs a literature review |
| `graphify` | only if the team repo gets big and you need to understand teammates' code |

## 4. How to call them
In Claude Code (inside `Tang/`):
```
Use planner. Feature: demo item 1 (multi-image upload).          # normal flow
Use designer + ui-ux-pro-max on <Figma link>: Result screen.     # new screen
Use systematic-debugging: count doesn't update after remove.     # bug, root cause first
Use test-driven-development: count math (model + adds - removes).# tests first
Use web-design-guidelines on web/src/pages/Result.tsx.           # UI review
/log-problem <what broke and why>                                # for the report
```
Agents: `coder`, `tester`, `reviewer`, `designer` have the `Skill` tool in their tool list so they can load these. If an agent says it can't see a skill, load the skill in the main session first, then hand over.

In the Claude app (Project "SPDS Capstone"):
```
Make my weekly progress doc from this week's docs/weekly note and problem log.   -> Docs artifact
Make demo slides for the 30 Nov checkpoint from requirements.md + screenshots.   -> Slides artifact
```

## 5. Per-phase cheat sheet
| Phase | Main skills |
|---|---|
| Nov (demo) | karpathy, ui-ux-pro-max, shadcn, systematic-debugging, TDD for count math |
| Dec (Supabase + compression) | karpathy, TDD (compression, adapter), dataviz (benchmark), systematic-debugging |
| Jan-Feb (integration + tests) | systematic-debugging, web-design-guidelines (usability fixes) |
| Mar (finalize) | Docs + Slides artifacts, dataviz |

## 6. Review this route
Sunday review: any skill that was never used in 2 weeks -> drop it from the table. Any job you did by hand 3 times -> make it a skill (`/log-problem`-style) in `.claude/skills/`.
