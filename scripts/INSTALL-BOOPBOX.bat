@echo off
title BoopBox installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-boopbox.ps1"
pause
