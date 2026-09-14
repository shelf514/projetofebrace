@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo  AQUASENSE AI - Configuracao completa (uma vez so)
echo ============================================================
echo.

echo [1/6] Criando ambiente Python do backend...
cd backend
if not exist .venv (
    python -m venv .venv
    if errorlevel 1 (
        echo ERRO: Python nao encontrado. Instale Python 3.10+ e tente de novo.
        pause
        exit /b 1
    )
)
call .venv\Scripts\activate.bat

echo [2/6] Instalando dependencias do backend...
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo ERRO: falha ao instalar dependencias.
    pause
    exit /b 1
)

echo [3/6] Criando arquivos .env (configuracao local)...
if not exist .env (
    copy .env.example .env >nul
    echo     backend\.env criado. TROQUE API_KEY de 'change-me' para valor forte!
)
if not exist ..\frontend\.env (
    copy ..\frontend\.env.example ..\frontend\.env >nul 2>&1
    if not errorlevel 1 echo     frontend\.env criado.
)

echo [4/6] Gerando dataset MOCK e treinando o modelo demo...
python -m ml.make_demo_dataset
python -m ml.train --dataset ml/datasets/demo_mock.csv --target status
if errorlevel 1 (
    echo ERRO: treinamento do modelo falhou.
    pause
    exit /b 1
)

echo [5/6] Populando o banco com leituras DEMO (30 dias)...
python scripts\seed_demo.py

echo [6/6] Instalando dependencias do frontend...
cd ..\frontend
if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo ERRO: falha ao instalar dependencias do frontend.
        pause
        exit /b 1
    )
)
cd ..\backend

echo.
echo ============================================================
echo  Configuracao concluida!
echo.
echo  Para rodar:
echo    - backend:  backend\ .venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
echo    - frontend: cd frontend ^&^& npm run dev
echo    - simular ESP32 (sem hardware): python scripts\simulate_esp32.py
echo ============================================================
pause
