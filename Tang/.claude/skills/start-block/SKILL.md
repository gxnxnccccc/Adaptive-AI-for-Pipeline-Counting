---
name: start-block
description: Start of a capstone work block (weekday 08:30). Syncs git, reads the plan and picks today's 1-3 tasks. Use when Tang says start, start block, or begins a session.
---

1. Remind Tang to run (do not run git yourself):
   ```bash
   git checkout main && git pull origin main
   git checkout -b tang/<feature>   # or: git checkout tang/<feature> && git pull --rebase origin main
   ```
2. Read `docs/requirements.md` (demo scope), the newest file in `docs/plans/`, the last 5 lines of `docs/problem-log.md`, and `docs/api-contract.md` OPEN fields.
3. Check today's date against the milestones: M1 8 Nov, M2 15 Nov, M3 22 Nov, M4 29 Nov, demo 30 Nov.
4. Reply in max 8 lines:
   ```
   TL;DR: today = <1 line>
   Milestone: <next> in <n> days, on track? <yes/no + why>
   Tasks (max 3, fit in 3h): 1) ... 2) ... 3) ...
   Blocked by others: <OPEN fields / waiting on whom>
   First command: <prompt to give the orchestrator>
   ```
If more than 3 tasks look necessary, say what to cut. Don't add tasks.
