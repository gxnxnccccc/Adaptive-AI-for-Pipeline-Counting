@echo off
rem SPDS live mode: pulls the latest code, installs what changed, starts API + web, opens the browser.
rem Needs git, Python 3.12+ and Node 20+. Close this window to stop.
cd /d "%~dp0"
python spds_live.py || py spds_live.py
pause
