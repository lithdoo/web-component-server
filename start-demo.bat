@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "packages\lsp-ws-server\dist\cli.js" (
  echo Building lsp-ws-server ^(first run^)...
  call npm run build:server
  if errorlevel 1 exit /b 1
)

echo [1/3] Starting lsp-ws-server on port 3000 (new window)...
set "LSP_ALLOWED_ROOTS=%CD%"
echo       LSP_ALLOWED_ROOTS=%LSP_ALLOWED_ROOTS% ^(inherited by the LSP window; server also allows cwd if unset^)
start "lsp-ws-server :3000" cmd /k "cd /d ""%~dp0"" && npm run start:lsp:3000"

timeout /t 2 /nobreak >nul

echo [2/3] Building component and starting static server on port 5175 (new window)...
start "demo-minimal :5175" cmd /k "cd /d ""%~dp0"" && npm run demo:minimal"

timeout /t 5 /nobreak >nul

echo [3/3] Opening browser...
start "" "http://localhost:5175/demos/minimal/index.html"

echo.
echo Two console windows were opened. Close them when you are done.
echo Minimal demo uses file-path=apps\demo\src\main.ts ^(LSP project root = repo^) and loads file text via fetch.
echo If the page fails to load, wait a few seconds and refresh (first build can be slow).
pause
