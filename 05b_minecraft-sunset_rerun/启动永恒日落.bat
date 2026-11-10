@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 Minecraft · 永恒日落 (Eternal Sunset) ...
start "" "http://localhost:5188/"
npx vite --port 5188
pause
