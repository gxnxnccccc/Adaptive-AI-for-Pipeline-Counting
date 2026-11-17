@echo off
rem Puts ONE "SPDS" shortcut on your Desktop that opens the app (runs SPDS-live.bat).
rem Run once. Run again only if you move or rename the repo folder.
rem Also removes the old SPDS.exe (Desktop + build folders), which is no longer used.
setlocal
cd /d "%~dp0"
taskkill /f /im SPDS.exe >nul 2>&1
rem Leftovers from the old exe builds (gitignored).
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d = [Environment]::GetFolderPath('Desktop');" ^
  "foreach ($old in @((Join-Path $d 'SPDS.exe'), (Join-Path $env:USERPROFILE 'Desktop\SPDS.exe'))) { if (Test-Path $old) { Remove-Item -Force $old; Write-Host ('Removed old ' + $old) } };" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'SPDS.lnk'));" ^
  "$s.TargetPath = '%~dp0SPDS-live.bat'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '%~dp0spds.ico';" ^
  "$s.Description = 'SPDS: get the latest code and open the web app'; $s.Save();" ^
  "Write-Host ('Done: double-click SPDS on your Desktop (' + $d + ')')"
if errorlevel 1 (echo Could not create the shortcut. & pause & exit /b 1)
pause
