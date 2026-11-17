# SPDS demo bundle (no Docker, no Node)

1. Install Python 3.12+ (tick "Add to PATH").
2. Download the repo (green Code button > Download ZIP, or `git clone`).
3. Open the `Tang/demo` folder and double-click **start.bat** (Mac/Linux: `./start.sh`).
4. Browser opens http://localhost:8000. Log in with any ID and the password `spds`.

First run installs packages (1-2 min), after that it starts in seconds. Close the window to stop.
Data lives in memory and is lost on restart. The detector is a mock.

`site/` is the built web app (rebuilt by Tang with `npm run build:demo` in `web/`). Don't edit it by hand.

## Tang's PC: one "SPDS" shortcut on the Desktop
- Make it **once**: double-click `make-shortcut.bat` (needs git, Python 3.12+, Node 20+). It puts an "SPDS" shortcut on the Desktop and removes the old `SPDS.exe`.
- Open the app = double-click **SPDS** on the Desktop. Every start it pulls the latest code (`git pull --ff-only`), installs changed packages, starts the API + web in live mode and opens the browser. New code = close the window and open SPDS again. Nothing to rebuild.
- Moved or renamed the repo folder? Run `make-shortcut.bat` again.
- If it says "Could not update automatically", you have local edits or the branch moved: commit/stash them, then reopen.

| File | What |
|---|---|
| `make-shortcut.bat` | Makes the Desktop shortcut (once) |
| `SPDS-live.bat` + `spds_live.py` | What the shortcut runs |
| `start.bat` / `start.sh` + `site/` | Friends without git/Node |
