@echo off
setlocal
chcp 65001 >nul

set "SCRIPT_DIR=%~dp0"
set "RELEASE_DIR=%SCRIPT_DIR%release"
set "REMOTE_USER=joshua"

set "REMOTE_HOST=wlzy.online"
set "REMOTE_PORT=10022"

@REM set "REMOTE_HOST=192.168.231.4"
@REM set "REMOTE_PORT=22"

set "REMOTE_RELEASE_DIR=~/workspace/expenseStatisticsProj/dockerSpace/release/"

for %%I in ("C:\Users\jiahu\.ssh\dell-joshua") do set "SSH_KEY=%%~fI"

if not exist "%RELEASE_DIR%" (
    echo Release directory not found: "%RELEASE_DIR%"
    exit /b 1
)

if not exist "%SSH_KEY%" (
    echo SSH key not found: "%SSH_KEY%"
    exit /b 1
)

echo Uploading "%RELEASE_DIR%" contents to %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_RELEASE_DIR%
scp -r -P %REMOTE_PORT% -i "%SSH_KEY%" "%RELEASE_DIR%\." %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_RELEASE_DIR%
if errorlevel 1 (
    echo SCP upload failed.
    exit /b 1
)

echo Upload completed.
exit /b 0
