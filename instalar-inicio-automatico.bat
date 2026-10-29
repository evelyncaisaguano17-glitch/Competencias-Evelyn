@echo off
set "SCRIPT_VBS=%~dp0iniciar-segundo-plano.vbs"
set "DESTINO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\EcosistemaEducativo.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESTINO%'); $s.TargetPath = '%SCRIPT_VBS%'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

echo ======================================================================
echo   [EXITO] Se ha configurado el inicio automatico permanente.
echo   El servidor se ejecutara siempre en segundo plano al encender la PC.
echo ======================================================================
pause
