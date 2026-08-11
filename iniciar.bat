@echo off
setlocal
title AquaSense AI - Iniciador
cd /d "%~dp0"

echo ============================================
echo    AQUASENSE AI - iniciando o sistema
echo ============================================
echo.

REM ---------- 1. Backend (porta 8000) ----------
netstat -ano | findstr /c:":8000" | findstr /c:"LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo [OK] Backend ja esta rodando na porta 8000.
) else (
  echo [1/3] Iniciando backend FastAPI...
  start "AquaSense Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
)

REM ---------- 2. Frontend (porta 5173) ----------
netstat -ano | findstr /c:":5173" | findstr /c:"LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo [OK] Frontend ja esta rodando na porta 5173.
) else (
  echo [2/3] Iniciando frontend React...
  start "AquaSense Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
)

REM ---------- 3. Aguardar backend responder ----------
echo [3/3] Aguardando os servidores iniciarem...
set /a tentativas=0

:espera_backend
set /a tentativas+=1
curl.exe -s -o NUL -w "%%{http_code}" --max-time 2 http://127.0.0.1:8000/api/health > "%TEMP%\aquasense_backend.txt"
set /p CODIGO=<"%TEMP%\aquasense_backend.txt"
if "%CODIGO%"=="200" goto backend_ok
if %tentativas% GEQ 40 (
  echo.
  echo [ERRO] O backend nao respondeu. Confira a janela "AquaSense Backend".
  echo        Comum: outra copia do backend ja aberta, ou porta 8000 ocupada.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto espera_backend

:backend_ok
set /a tentativas=0

:espera_frontend
set /a tentativas+=1
curl.exe -s -o NUL -w "%%{http_code}" --max-time 2 http://127.0.0.1:5173/ > "%TEMP%\aquasense_frontend.txt"
set /p CODIGO=<"%TEMP%\aquasense_frontend.txt"
if "%CODIGO%"=="200" goto frontend_ok
if %tentativas% GEQ 40 (
  echo.
  echo [ERRO] O frontend nao respondeu. Confira a janela "AquaSense Frontend".
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto espera_frontend

:frontend_ok
del "%TEMP%\aquasense_backend.txt" >nul 2>&1
del "%TEMP%\aquasense_frontend.txt" >nul 2>&1
echo.
echo [OK] Tudo pronto! Abrindo o dashboard...
start "" http://localhost:5173
echo.
echo Dica: se aparecer "Erro de conexao", aguarde alguns segundos - o
echo dashboard atualiza sozinho a cada 10 segundos.
echo.
pause
exit /b 0
