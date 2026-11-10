# SPDS demo bundle (no Docker, no Node)

1. Install Python 3.12+ (tick "Add to PATH").
2. Download the repo (green Code button > Download ZIP, or `git clone`).
3. Open the `Tang/demo` folder and double-click **start.bat** (Mac/Linux: `./start.sh`).
4. Browser opens http://localhost:8000. Log in with any ID and password.

First run installs packages (1-2 min), after that it starts in seconds. Close the window to stop.
Data lives in memory and is lost on restart. The detector is a mock.

`site/` is the built web app (rebuilt by Tang with `npm run build:demo` in `web/`). Don't edit it by hand.
