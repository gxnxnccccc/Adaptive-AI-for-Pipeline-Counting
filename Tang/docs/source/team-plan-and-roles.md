# Team plan and roles (from the "Plan" Google Sheet + project PDF, checked 2 Nov 2026)

## Roles (Plan sheet, tab "Role")
| Person | Role |
|---|---|
| Guy | App Dev (Mobile) |
| Tang | Fullstack Dev |
| Game (lead), Hymn/Hymm (assist) | ML Engineer |
| Opor | AI Engineer |
| Hymn/Hymm | Data Engineer |

## Workload (PDF, Head / Sub)
| | ML data collect | Model training | Detection code | Frontend | Backend | App dev |
|---|---|---|---|---|---|---|
| Game | Head | Head | | Sub | | Sub |
| Hymn | Sub | Sub | Sub | | **Head** | |
| Tang | | | | **Head** | | Sub |
| Opor | | | **Head** | | Sub | Sub |
| Guy | | Sub | | Sub | | **Head** |

OPEN: Plan sheet lists Backend under Fullstack, the PDF gives Backend head to Hymn. Tang's current assumption: web app + FastAPI API layer are Tang's, core data/infra with Hymn. Confirm with the team.

## Overall plan (Plan sheet, tab "Overall Plan")
| Month | Nov 2026 | Dec | Jan 2027 | Feb | Mar | Apr |
|---|---|---|---|---|---|---|
| Web + App | x | x | | | | |
| Model | | x | x | | | |
| Integration | | | x | x | | |
| Test | | | | x | x | |
| Finalize | | | | | x | x |

Per-role plan tabs (App Dev, Fullstack, ML, AI, Data) are still empty in the sheet. Tang's draft is in `../../CLAUDE.md` milestones and `fullstack-plan-paste.tsv`.

## Method options (PDF)
- OpenCV: no training, light, but sensitive to lighting/shadows (needs tuned Canny/HoughCircles values), limited accuracy in real scenes.
- YOLO/AI: more accurate, handles lighting/orientation/background, needs data collection + training + more compute.
- If a method fails on real pipes: try lighting/color plug-in libraries, or find another model.
- Flow: collect data -> choose method -> test on real product -> combine with website -> send data to company DB -> app interface -> iOS + Android -> finalize.
