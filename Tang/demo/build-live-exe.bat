@echo off
rem Builds Desktop\SPDS.exe = the LIVE launcher for THIS repo folder (spds_live.py).
rem Build once: the exe pulls new code itself on every start, so you don't rebuild after code changes.
cd /d "%~dp0"
taskkill /f /im SPDS.exe >nul 2>&1
rem Delete the old exe and old build output first, so nothing stale gets reused.
timeout /t 1 /nobreak >nul
if exist "%USERPROFILE%\Desktop\SPDS.exe" del /f /q "%USERPROFILE%\Desktop\SPDS.exe"
if exist "%USERPROFILE%\Desktop\SPDS.exe" (echo Could not delete Desktop\SPDS.exe. Close it and try again. & pause & exit /b 1)
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build
for %%I in ("%~dp0..\..") do set "REPO=%%~fI"
if not exist build mkdir build
> build\repo_path.txt echo %REPO%
if not exist .venv\Scripts\python.exe python -m venv .venv || (echo Python not found & pause & exit /b 1)
.venv\Scripts\python -m pip install -q pyinstaller || (echo pip install failed & pause & exit /b 1)
.venv\Scripts\python -m PyInstaller --noconfirm --clean --onefile --console --name SPDS ^
  --distpath dist --workpath build\work --specpath build ^
  --add-data "%~dp0build\repo_path.txt;." spds_live.py || (echo PyInstaller failed & pause & exit /b 1)
copy /y dist\SPDS.exe "%USERPROFILE%\Desktop\SPDS.exe" >nul && echo Done: Desktop\SPDS.exe now updates itself and opens the browser.
pause
