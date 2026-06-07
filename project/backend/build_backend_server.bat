@echo off
setlocal

if not defined GOOS set GOOS=linux
if not defined GOARCH set GOARCH=amd64

echo Building backend for %GOOS%/%GOARCH%...

if exist release (
    rmdir /s /q release
)

mkdir release\internal\platform\config
if errorlevel 1 (
    echo Failed to create release directory.
    exit /b 1
)

set CGO_ENABLED=0
go build -o .\release\server .\cmd\server\
if errorlevel 1 (
    echo Go build failed.
    exit /b 1
)

copy /y .\internal\platform\config\config.prod.docker.yaml .\release\internal\platform\config\config.prod.docker.yaml >nul
if errorlevel 1 (
    echo Failed to copy config.prod.docker.yaml.
    exit /b 1
)

copy /y .\docker_start_backend.sh .\release\ >nul
if errorlevel 1 (
    echo Failed to copy docker_start_backend.sh.
    exit /b 1
)

echo Backend build completed: .\release\server
exit /b 0
