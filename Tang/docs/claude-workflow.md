# Claude workflow: which chat for what, when to use Claude Code

TL;DR: **Claude Code = anything that touches files in the repo. Claude app (in one Project) = thinking, learning, writing, talking to people.** 1 Project + 5 chat lanes + Claude Code. Context lives in `docs/`, not in long chat history.

## 1. Setup (once)
1. Claude app -> create Project **"SPDS Capstone"**.
2. Project knowledge: upload `Tang/CLAUDE.md`, `AGENTS.md`, `docs/requirements.md`, `docs/api-contract.md`, `docs/tech-stack.md`, the capstone PDF, and PNG exports of the main Figma screens. Re-upload when they change a lot (Sunday review is a good moment).
3. Project instructions (paste): "SPDS capstone, Tang = Fullstack (web + FastAPI). TL;DR first, short, tables. Hint first when I'm learning. Never invent ML model fields. Before 30 Nov only demo scope."
4. Laptop: clone the team repo, open Claude Code inside `Tang/`. Optional: connect the Supabase and Figma MCP servers in Claude Code so agents can read the DB schema and frames.

## 2. Chats (Claude app, all inside the Project)
| # | Chat | Use for | New chat when |
|---|---|---|---|
| 1 | **Weekly review W<n>** | Sunday 10:30: check calendar, last week vs plan, pick next week's 3 goals | every Sunday (new one each week) |
| 2 | **Tech decisions** | stack/library/architecture choices, compare options | per big decision (DB choice, hosting, model integration) |
| 3 | **Learning** | understand FastAPI, React, SSIM, OpenCV (hint first, explanations in Thai if you like) | per topic |
| 4 | **Team comms** | messages to Game/Hymn/Opor/Guy, questions for the professor, PR descriptions | per message thread |
| 5 | **Report & slides** | report chapters (from problem log + decisions), presentation | per chapter / deck |

Rule: one topic per chat. When a chat gets long or drifts, ask Claude for a 10-line summary, paste it into the right `docs/` file, start fresh.

## 3. Claude Code (laptop, inside `Tang/`)
Use it when the answer is a change to a file:
| Situation | Claude Code? |
|---|---|
| Write / fix / test code in `web/` or `api/` | Yes |
| Update `docs/` (plans, problem log, decisions) | Yes (scribe) |
| Run tests, read errors, debug | Yes |
| Read teammates' code to integrate | Yes (read only) |
| Turn a Figma frame into a build spec | Yes (`designer`) |
| Create/alter Supabase tables | Yes, as a migration file (Supabase MCP), dev project first |
| Design the screens themselves | No, you in Figma (ask the Tech decisions chat for UX ideas) |
| "Which DB should we use?" | No, Tech decisions chat |
| "Explain how React state works" | No, Learning chat |
| Write a message to the professor | No, Team comms chat |
| git push / PR | You run it (Claude Code drafts the commands via `/end-block`) |

Session pattern (fits 08:30-11:30):
```
08:30  /start-block            -> today's 1-3 tasks
08:40  orchestrator: feature   -> planner -> coder -> tester -> reviewer -> scribe
11:15  /end-block              -> commit msg + PR text, you push
```
One Claude Code session per block. Next day: new session, `/start-block` reads `docs/` so nothing is lost.

## 4. Where info flows
```
Claude app chats --(summary)--> docs/*.md in Tang/ --(git)--> team repo
                                  ^
Claude Code agents ---------------┘ (scribe writes logs, planner writes plans)
docs/ --(re-upload Sunday)--> Project knowledge
```

## 5. Cost / focus guard
- Don't open a new chat for every small question. Ask Claude Code if it's about code.
- If you have more than 5 active chats, you're scattered. Close what's done.
