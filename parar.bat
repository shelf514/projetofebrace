@echo off
title AquaSense AI - Parar servidores
echo Encerrando os servidores do AquaSense AI...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
echo.
echo Servidores encerrados. Pode fechar esta janela.
pause
