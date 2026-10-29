@echo off
set "DESTINO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\EcosistemaEducativo.lnk"

if exist "%DESTINO%" (
  del "%DESTINO%"
  echo [OK] Se ha removido el inicio automatico.
) else (
  echo [INFO] No habia inicio automatico configurado.
)
pause
