@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 COUNTER-STRIKE 2 · DE_DUST2 (炙热沙城 II 5v5 战术竞技版) ...
start "" "http://localhost:5173/"
npx vite --port 5173
pause
