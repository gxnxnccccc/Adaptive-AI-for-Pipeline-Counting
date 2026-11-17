# SPDS demo bundle (no Docker, no Node)

1. Install Python 3.12+ (tick "Add to PATH").
2. Download the repo (green Code button > Download ZIP, or `git clone`).
3. Open the `Tang/demo` folder and double-click **start.bat** (Mac/Linux: `./start.sh`).
4. Browser opens http://localhost:8000. Log in with any ID and the password `spds`.

First run installs packages (1-2 min), after that it starts in seconds. Close the window to stop.
Data lives in memory and is lost on restart. The detector is a mock.

`site/` is the built web app (rebuilt by Tang with `npm run build:demo` in `web/`). Don't edit it by hand.

## SPDS.exe = live launcher (Tang's PC)
`SPDS-live.bat` / `SPDS.exe` (from `spds_live.py`) runs THIS repo folder: on every start it pulls the latest code (`git pull --ff-only`), installs changed packages, starts the API + web in live mode and opens the browser by itself.
- Build the exe **once**: double-click `build-live-exe.bat` (needs git, Python 3.12+, Node 20+). It deletes the old `Desktop\SPDS.exe`, builds the new one and starts it.
- After that, new code = just close and reopen `SPDS.exe`. The exe pulls, then runs the repo's own `spds_live.py`, so even launcher changes need no rebuild (only if Python is missing from PATH does it fall back to the copy baked into the exe).
- If it says "Could not update automatically", you have local edits or the branch moved: commit/stash them, then reopen.

## Frozen bundle (friends without git/Node)
`build-exe.bat` packs `site/` + the API into one exe. It is a snapshot: rebuild it after changes.
