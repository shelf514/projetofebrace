# AquaSense AI

Sistema de monitoramento da qualidade da água de baixo custo para projeto científico (FEBRACE).

O AquaSense AI coleta medições de temperatura, turbidez e TDS com um **ESP32**, envia os dados por Wi-Fi para um **backend FastAPI**, aplica **Machine Learning** (previsão de condição + detecção de anomalias) e exibe tudo em um **dashboard web responsivo** — que também é empacotado como **APK Android** (Capacitor). Leituras novas aparecem no dashboard em **tempo real via WebSocket** (com fallback automático para polling).

> **Aviso científico:** as previsões do modelo são saídas estatísticas e **não constituem certificação sanitária** nem atestam potabilidade da água.

## Arquitetura

```
Sensores (DS18B20, turbidez, TDS)
        ↓
      ESP32  ── coleta, valida e envia (sem IA)
        ↓ Wi-Fi / HTTP POST
   Backend FastAPI (Python)
        ↓
   SQLite (readings, devices)
        ↓
   ML (RandomForest + Isolation Forest)
        ↓
   Dashboard React (web) / APK Android
```

## Hardware

- ESP32 DevKit
- DS18B20 waterproof (temperatura) — pino 4 (OneWire)
- Sensor de turbidez (analógico) — pino 34
- Sensor TDS (analógico) — pino 35
- LED onboard (status)

**Segurança da montagem:** as placas eletrônicas e o ESP32 **nunca entram em contato com a água** — somente as sondas ficam submersas. O ESP32 apenas coleta, valida e envia os dados; **a IA roda no backend**.

## Estrutura do projeto

```
├── backend/                 # API FastAPI + pipeline de ML
│   ├── app/                 # código da API (models, schemas, services, api)
│   ├── ml/                  # treinamento, avaliação, datasets
│   ├── scripts/             # seed de dados demo (MOCK)
│   ├── tests/               # testes pytest
│   ├── requirements.txt
│   └── .env.example
├── frontend/                # dashboard React (Vite + TS + Tailwind + Recharts)
│   ├── src/                 # páginas, componentes, serviços, hooks
│   ├── android/             # projeto Android (Capacitor) para gerar o APK
│   └── .env.example
├── firmware/esp32/          # firmware PlatformIO (C++)
├── data/                    # dados brutos / processados (não versionados)
├── docs/                    # architecture, hardware, methodology
└── README.md
```

## Instalação

Requisitos: Python 3.11+, Node.js 20+.

**Automática (Windows):** rode `setup.bat` na raiz — cria o venv, instala dependências,
gera o dataset MOCK, treina o modelo demo, popula o banco com leituras DEMO e instala o frontend.

**Manual:**

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # Windows (Linux/Mac: cp .env.example .env)
```

## Como executar o backend

```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Documentação interativa da API: http://localhost:8000/docs

### Dados demo (MOCK)

Dados sintéticos **apenas para teste** — nunca apresente como dados científicos reais:

```bash
cd backend
.venv\Scripts\python.exe -m ml.make_demo_dataset          # gera ml/datasets/demo_mock.csv
.venv\Scripts\python.exe -m ml.train --dataset ml/datasets/demo_mock.csv   # treina o modelo demo
.venv\Scripts\python.exe scripts\seed_demo.py             # popula ~30 dias de leituras MOCK
```

### Simular o ESP32 sem hardware

O script `scripts/simulate_esp32.py` replica exatamente o POST do firmware
(útil para testar a API, o WebSocket e o dashboard antes da montagem):

```bash
cd backend
.venv\Scripts\python.exe scripts\simulate_esp32.py --count 10 --interval 1
.venv\Scripts\python.exe scripts\simulate_esp32.py --anomalies   # injeta picos p/ testar alertas
```

O dashboard mostra o selo **DEMO — dados simulados** para leituras de dispositivos simulados
(`AQUASENSE-SIM`/`AQUASENSE-DEMO`) e **Modelo DEMO (dataset MOCK)** quando o modelo foi
treinado com dados sintéticos.

## Como executar o frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Para o celular/APK acessar o backend, configure o IP do computador na rede local
(ou use o ícone ⚙ no próprio dashboard para trocar o endereço sem rebuild).

## Como gerar o APK Android

```bash
cd frontend
npm install
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug     # APK em: android/app/build/outputs/apk/debug/app-debug.apk
```

Requisitos: JDK 21 (JAVA_HOME) e Android SDK (ANDROID_HOME) com platform android-35/36 e build-tools.

Instale o APK no celular/tablet, abra o ⚙ e informe `http://<IP_DO_PC>:8000`.
O backend deve rodar com `--host 0.0.0.0` para ser acessível na rede local.

## Como configurar o ESP32

1. Instale o PlatformIO (`pip install platformio`).
2. `cd firmware/esp32`
3. Copie `include/secrets.example.h` para `include/secrets.h` e preencha:
   - `WIFI_SSID` / `WIFI_PASSWORD`
   - `API_URL` (ex.: `http://192.168.0.10:8000/api/readings`)
   - `API_KEY` (mesmo valor de `API_KEY` no `.env` do backend)
4. Compile e envie:

```bash
platformio run -d firmware/esp32 -t upload
```

O intervalo de leitura, pinos e calibração dos sensores ficam em `include/config.h`.
O `secrets.h` **não deve ser commitado** (veja `.gitignore`).

### Modo calibração e retry com backoff

- **Calibração:** defina `CALIBRATION_MODE 1` em `config.h`, grave e abra o Monitor Serial —
  o ESP32 imprime ADC/tensão de cada sensor a cada segundo, sem enviar nada.
  Volte para `0` e grave novamente quando terminar.
- **Retry com backoff:** se o envio HTTP falhar, o firmware espera 5 s → 10 s → 20 s → 60 s (máx)
  entre tentativas, evitando inundar a rede; o intervalo volta ao normal após o sucesso.
- Guia passo a passo pós-montagem: `docs/validacao-pos-montagem.md`.

## Como adicionar um dataset real

1. Coloque o arquivo em `backend/ml/datasets/` (CSV, XLSX ou JSON).
2. O dataset precisa das colunas `temperature`, `turbidity`, `tds` e de uma variável-alvo
   (`status`, `quality`, `class`, `label`, `target`, `value`...).
3. Registre origem e licença dos dados em `docs/methodology.md`.

**Não invente labels**: se o dataset não tem variável-alvo, use o modo de detecção de anomalias (Isolation Forest), já integrado ao backend.

## Como treinar o modelo

```bash
cd backend
.venv\Scripts\python.exe -m ml.train --dataset ml/datasets/SEU_DATASET.csv --target status
```

Salva em `ml/outputs/`: `model.pkl`, `scaler.pkl` (se aplicável) e `metadata.json`
(modelo, dataset, features, métricas, overfitting, importância das features).

Também é possível treinar pela API: `POST /api/ml/train` (requer `X-API-Key`).

## Como executar os testes

```bash
# Backend + ML
cd backend
.venv\Scripts\python.exe -m pytest tests -q

# Frontend
cd frontend
npm test
```

## Como conectar o ESP32 (fluxo de uso)

1. Suba o backend no notebook: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
2. Monte o circuito e suba o firmware no ESP32 (com `secrets.h` preenchido).
3. O ESP32 envia medições a cada `MEASUREMENT_INTERVAL_SEC` segundos.
4. Acompanhe no dashboard: http://localhost:5173 (ou APK no celular).
5. Para conferir o envio, use `platformio device monitor` (Serial 115200).

## API resumida

| Método | Rota                     | Descrição                                   |
| ------ | ------------------------ | ------------------------------------------- |
| POST   | `/api/readings`          | Recebe medição do ESP32 (requer API key)    |
| GET    | `/api/readings`          | Histórico com filtros e paginação           |
| GET    | `/api/readings/latest`   | Medição mais recente                        |
| GET    | `/api/readings/history`  | Filtro por período                          |
| GET    | `/api/readings/export`   | Exporta leituras do período em CSV          |
| GET    | `/api/readings/stats`    | Estatísticas (min/max/média)                |
| WS     | `/ws/readings`           | Stream em tempo real de novas leituras      |
| GET    | `/api/devices`           | Lista dispositivos                          |
| GET    | `/api/devices/{id}`      | Detalhe de um dispositivo                   |
| GET    | `/api/health`            | Health check                                |
| POST   | `/api/predict`           | Previsão pontual do modelo                  |
| GET    | `/api/ml/status`         | Informações do modelo carregado             |
| GET    | `/api/ml/datasets`       | Lista datasets disponíveis                  |
| POST   | `/api/ml/train`          | Treina modelo (requer API key)              |
