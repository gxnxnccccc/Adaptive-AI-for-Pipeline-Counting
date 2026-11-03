---
name: end-block
description: End of a capstone work block (11:30). Summarises what changed, makes sure problems are logged, and drafts the commit message and PR text. Use when Tang says end, wrap up, or done for today.
---

1. Run `git status` and `git diff --stat` (read-only). If any changed file is outside `Tang/`, warn first.
2. Ask `scribe` to log any problem from this block that isn't in `docs/problem-log.md` yet, and tick requirements that got reviewer PASS.
3. Reply:
   ```
   TL;DR: <what got done>
   Changed: <files>
   Not done / carry over: <list>
   Commands for Tang to run:
     git add Tang/
     git commit -m "<web:|api:|docs:> <summary>"
     git pull --rebase origin main
     git push -u origin tang/<feature>
   PR title: <...>
   PR body: <3 bullets: what, how tested, open questions>
   ```
Never run commit, push or PR commands yourself.
