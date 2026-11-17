@echo off
title SPDS
rem SPDS: pulls the latest code, installs what changed, starts API + web, opens the browser.
rem Open it with the "SPDS" Desktop shortcut (make-shortcut.bat). Needs git, Python 3.12+, Node 20+. Close this window to stop.
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (py -3 spds_live.py) else (python spds_live.py)
pause
