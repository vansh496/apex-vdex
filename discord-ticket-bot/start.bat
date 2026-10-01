@echo off
setlocal
cd /d "%~dp0"
title APEX Ticket Bot

echo ==========================================================
echo   APEX DISCORD TICKET BOT
echo ==========================================================
echo.

REM --- Python check ---
where python >nul 2>nul
if errorlevel 1 (
    echo [X] Python nahi mila.
    echo     https://www.python.org/downloads/ se install karo
    echo     (Install karte waqt "Add to PATH" ZAROOR tick karo)
    echo.
    pause
    exit /b 1
)

REM --- .env check ---
if not exist ".env" (
    echo [!] .env file nahi mili.
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [OK] .env bana diya — ab usme DISCORD_TOKEN paste karo.
    )
    echo.
    pause
    exit /b 1
)

REM --- Install dependency (sirf ek baar chalta hai) ---
python -c "import discord" >nul 2>nul
if errorlevel 1 (
    echo [*] discord.py install ho raha hai...
    python -m pip install -q -r requirements.txt
    if errorlevel 1 (
        echo [X] Install fail. Internet check karo.
        pause
        exit /b 1
    )
    echo [OK] discord.py install ho gaya.
    echo.
)

echo [*] Bot start ho raha hai... (band karne ke liye Ctrl+C)
echo.
python bot.py

echo.
echo Bot band ho gaya.
pause
