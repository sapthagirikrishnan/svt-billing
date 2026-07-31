@echo off
echo ============================================
echo   GST BillBook - Installing dependencies
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js LTS from https://nodejs.org and re-run this file.
    pause
    exit /b 1
)

echo Node.js found. Installing packages, this may take a minute...
echo.
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed. See the messages above.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Install complete!
echo   Run start.bat to launch the application.
echo ============================================
pause
