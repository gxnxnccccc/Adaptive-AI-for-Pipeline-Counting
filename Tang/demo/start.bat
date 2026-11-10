@echo off
rem SPDS demo: double-click. Needs Python 3.12+ only. First run installs packages (1-2 min).
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo First run: setting up, please wait...
  python -m venv .venv || (echo Python not found. Install Python 3.12 from python.org and tick "Add to PATH". & pause & exit /b 1)
  .venv\Scripts\python -m pip install -q -r ..\api\requirements.txt || (echo Install failed. & pause & exit /b 1)
)
set DEMO_MEMORY=true
start "" http://localhost:8000
cd ..\api
..\demo\.venv\Scripts\python -m uvicorn app.main:app --port 8000
pause
