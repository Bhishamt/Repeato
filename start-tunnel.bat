@echo off
title Repeato Server & Cloudflare Tunnel
cd /d "%~dp0"

echo ==================================================
echo   Starting Repeato + Cloudflare Tunnel
echo ==================================================

echo [1/3] Starting local database cluster...
node scripts\pg.mjs start

echo [2/3] Starting Next.js web application...
start "Repeato Web Server" /min cmd /c "npm start"

timeout /t 3 /nobreak >nul

echo [3/3] Launching Cloudflare public tunnel...
echo (Your public https://...trycloudflare.com link will appear below)
echo.
npx cloudflared tunnel --url http://localhost:3000

