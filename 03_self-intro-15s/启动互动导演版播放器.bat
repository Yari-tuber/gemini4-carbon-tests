@echo off
chcp 65001 >nul
title ANTIGRAVITY — 15s Interactive WebGL2 Director's Cut
cd /d "%~dp0"
python serve_interactive.py
