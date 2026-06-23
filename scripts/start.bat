@echo off
REM Start the app (Windows)
cd /d "%~dp0.."
docker compose up -d --build
echo App running at http://localhost:8000
