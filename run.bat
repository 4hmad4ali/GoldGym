@echo off
chcp 65001 >nul 2>&1
title Golden Gym — جیم گلدن
color 0A

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

if exist ".venv\Scripts\python.exe" (
    set "PYTHON=.venv\Scripts\python.exe"
) else if exist ".venv-system\Scripts\python.exe" (
    set "PYTHON=.venv-system\Scripts\python.exe"
) else (
    set "PYTHON=py -3.14"
)

echo.
echo  ============================================================
echo    🏋 Golden Gym — v4.0
echo    Professional Gym Management System
echo    Pure Desktop — No Web Server
echo  ============================================================
echo.

%PYTHON% --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed!
    echo  Please install Python from https://python.org
    pause
    exit /b 1
)

echo  [1/5] Python found successfully...

echo  [2/5] Checking dependencies...

%PYTHON% -c "import webview, qrcode, PIL" >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Required packages are missing.
    echo  Run: py -3.14 -m venv .venv
    echo  Then: .venv\Scripts\python.exe -m pip install -r requirements.txt
    pause
    exit /b 1
)

if not exist "data" mkdir data
if not exist "user_data" mkdir user_data
if not exist "user_data\members" mkdir user_data\members
if not exist "user_data\staff" mkdir user_data\staff
if not exist "user_data\coaches" mkdir user_data\coaches
if not exist "assets" mkdir assets
if not exist "frontend\css" mkdir frontend\css
if not exist "frontend\js\pages" mkdir frontend\js\pages

echo  [3/5] Directories created successfully...

echo  [4/5] Starting Golden Gym...
echo.
%PYTHON% main.py

if errorlevel 1 (
    echo.
    echo  [ERROR] Application closed with an error.
    pause
)
