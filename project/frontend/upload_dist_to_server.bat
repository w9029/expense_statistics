@echo off
setlocal
chcp 65001 >nul

set "SCRIPT_DIR=%~dp0"
set "DIST_DIR=%SCRIPT_DIR%apps\web\dist"
set "REMOTE_USER=root"
set "REMOTE_HOST=wlzy.online"
set "REMOTE_PORT=22"
set "REMOTE_DIST_DIR=/var/www/expenseStatistics/"

for %%I in ("C:\Users\jiahu\.ssh\wlzy-root") do set "SSH_KEY=%%~fI"

if not exist "%DIST_DIR%" (
    echo Dist directory not found: "%DIST_DIR%"
    exit /b 1
)

if not exist "%SSH_KEY%" (
    echo SSH key not found: "%SSH_KEY%"
    exit /b 1
)

echo Uploading "%DIST_DIR%" contents to %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_DIST_DIR%
scp -r -P %REMOTE_PORT% -i "%SSH_KEY%" "%DIST_DIR%\." %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_DIST_DIR%
if errorlevel 1 (
    echo SCP upload failed.
    exit /b 1
)

echo Upload completed.
exit /b 0
