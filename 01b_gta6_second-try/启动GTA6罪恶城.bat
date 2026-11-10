@echo off
chcp 65001 >nul
title GRAND THEFT AUTO VI - Vice City / Leonida
cd /d "%~dp0"
echo ========================================================
echo    GRAND THEFT AUTO VI — 罪恶城 (Vice City / Leonida)
echo    正在启动本地 3D 游戏引擎服务器...
echo ========================================================
start "" "http://localhost:5176"
npm run dev
pause
