@echo off
rem Rebuilds SPDS.exe from the CURRENT web + api code. Run after every UI/API change. Needs Python 3.12+ and Node 20+.
rem Stops any running SPDS.exe first (an old copy keeps the port and the old UI alive). Output: Tang\demo\dist\SPDS.exe  (also copied to your Desktop). Close any running SPDS.exe first.
cd /d "%~dp0"
taskkill /f /im SPDS.exe >nul 2>&1
echo [1/3] Building the web app...
pushd ..\web
call npm ci --no-audit --no-fund || (echo npm install failed & popd & pause & exit /b 1)
call npm run build:demo || (echo web build failed & popd & pause & exit /b 1)
popd
echo [2/3] Setting up the build environment...
if not exist .venv\Scripts\python.exe python -m venv .venv || (echo Python not found & pause & exit /b 1)
.venv\Scripts\python -m pip install -q -r ..\api\requirements.txt pyinstaller || (echo pip install failed & pause & exit /b 1)
echo [3/3] Packaging SPDS.exe...
.venv\Scripts\python -m PyInstaller --noconfirm --clean --onefile --name SPDS ^
  --distpath dist --workpath build --specpath build ^
  --add-data "%~dp0site;demo/site" --add-data "%~dp0..\api\app;api/app" ^
  --paths "%~dp0..\api" --collect-submodules uvicorn --collect-submodules app --collect-submodules supabase ^
  --collect-data tzdata spds_launcher.py || (echo PyInstaller failed & pause & exit /b 1)
copy /y dist\SPDS.exe "%USERPROFILE%\Desktop\SPDS.exe" >nul && echo Done: Desktop\SPDS.exe is up to date.
pause
