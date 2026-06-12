@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%start_compare.ps1"

if not exist "%PS1%" (
    echo start_compare.ps1 not found.
    pause
    exit /b 1
)

start "Metro Compare" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoExit -ExecutionPolicy Bypass -File "%PS1%" %*
exit /b 0
