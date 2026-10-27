@echo off
setlocal
title RCC-APS Shutdown
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0rcc-aps\scripts\windows.ps1" -Action Stop
set "RCC_RESULT=%errorlevel%"
if not "%RCC_APS_NO_PAUSE%"=="1" pause
exit /b %RCC_RESULT%
