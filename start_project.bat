@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%start_project.ps1"
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%PS1%" (
    echo start_project.ps1 not found.
    pause
    exit /b 1
)

"%POWERSHELL%" -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -CheckOnly
if errorlevel 1 (
    echo.
    echo Pre-launch check failed. See the message above.
    pause
    exit /b 1
)

start "Metro Router" "%POWERSHELL%" -NoExit -ExecutionPolicy Bypass -File "%PS1%" %*
exit /b 0
