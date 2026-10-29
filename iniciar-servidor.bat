@echo off
title Ecosistema Educativo - Servidor
cd /d "%~dp0"

echo ========================================================
echo   Ecosistema Educativo Digital - Servidor Permanente
echo   Disponible en: http://localhost:3000
echo ========================================================

:bucle
node servidor/server.js
echo [AVISO] El proceso del servidor se cerro. Reiniciando en 3 segundos...
timeout /t 3 /nobreak >nul
goto bucle
