# Arquitetura do AquaSense AI

## Visão geral

O sistema é dividido em cinco camadas desacopladas:

1. **Hardware** — ESP32 + sensores (DS18B20, turbidez, TDS)
2. **Backend** — API FastAPI (Python) + SQLite
3. **Machine Learning** — pipeline de treinamento + inferência + anomalias
4. **Tempo real** — WebSocket `/ws/readings` (com fallback para polling)
5. **Frontend** — dashboard React (web) + APK Android (Capacitor)

```
Sensores
   ↓
ESP32 (coleta, valida, envia — SEM IA)
   ↓  HTTP POST /api/readings (JSON + X-API-Key)
FastAPI (FastAPI + SQLAlchemy + Pydantic)
   ├── validação física (soft/hard bounds, NaN, tipos, timestamp)
   ├── inferência ML (model.pkl carregado em memória)
   ├── detecção de anomalias (Isolation Forest + z-score por dispositivo)
   └── SQLite (readings, devices)
   ↓  REST/JSON + WS (broadcast de novas leituras)
Dashboard React (tempo real + fallback polling 10-15s) / APK
```

## Decisões de arquitetura

### Por que o ESP32 não executa IA
O modelo é treinado com scikit-learn (RandomForest) e o ESP32 não possui
ecossistema equivalente nem memória para tal. A IA roda no backend, onde o
modelo pode ser re-treinado com novos dados. O ESP32 faz apenas:
coleta → média de amostras → validação física → POST.

### Comunicação HTTP REST + WebSocket (com fallback polling)
O ESP32 envia via HTTP POST (robusto em redes de feira). O dashboard recebe
leituras novas em **tempo real via WebSocket `/ws/readings`** (broadcast do
backend a cada `POST /api/readings`, simulador DEMO incluído) com **fallback
automático para polling** (10 s `latest`, 15 s `history`, 30 s `devices/ml`)
quando o WS está indisponível — e o poll do `latest` é pausado com o WS vivo.

### Banco de dados
SQLite foi escolhido pela simplicidade de implantação local. A camada usa
SQLAlchemy, então a troca para PostgreSQL é feita apenas alterando
`DATABASE_URL` no `.env` (o `render.yaml` já provisiona Postgres via
`fromDatabase`; o backend normaliza `postgres://` → `postgresql+psycopg://`).

### Validação em duas camadas
- **Pydantic + hard bounds**: rejeita payloads malformados e valores
  fisicamente absurdos (422) — nada é gravado.
- **Soft bounds + Isolation Forest**: valores fora do esperado **não são
  rejeitados**; são gravados e marcados como anomalia.

## Fluxo de uma medição

```
POST /api/readings
  → Pydantic valida tipos/NaN/timestamp
  → is_hard_violation? 422 : prossegue
  → get_or_create_device (atualiza last_seen/status)
  → ml_service.predict → prediction, probability
  → anomaly_detector.on_new_reading (Isolation Forest + soft bounds)
  → INSERT readings
  → 201 ReadingOut
```

## Fluxo de treinamento (offline ou via API)

```
Dataset (CSV/XLSX/JSON em ml/datasets/)
  → load_dataframe (extensão validada)
  → infer_target (nunca inventa labels)
  → validate_and_clean (NaN, features ausentes, tamanho mínimo)
  → train_test_split (stratified para classificação)
  → RandomForestClassifier / RandomForestRegressor (+ scaler na regressão)
  → métricas (accuracy/precision/recall/F1 + matriz de confusão | MAE/RMSE/R²)
  → check_overfitting (gap treino×teste > 0.15 → alerta)
  → feature_importance
  → salva model.pkl + scaler.pkl + metadata.json
```

O `metadata.json` registra versão, data, dataset, features, target, modelo,
parâmetros, métricas, rótulos e origem dos dados.

## Detecção de anomalias

- Modelo **por dispositivo** (cada dispositivo tem seu próprio "normal"): um
  `IsolationForest(contamination=0.05)` + `StandardScaler` treinado apenas sobre
  o histórico **daquele** dispositivo (até 1000 leituras).
- **Z-score robusto (mediana/MAD)** com limiar 5.0 aplicado sobre o mesmo
  histórico: o Isolation Forest satura para valores muito além do range de
  treino (ex.: pico de contaminação 10× acima do normal), então essa camada
  estatística garante que extremos físicos sejam marcados.
- Re-treino a cada `ANOMALY_RETRAIN_EVERY` (default 100) leituras por dispositivo.
- Com poucos dados (< 20 amostras), usa apenas os soft bounds.
- O resultado (`normal/anomaly`) é gravado em cada leitura.
- `POST /api/predict` usa o mesmo detector do fluxo de leituras (via
  `device_id` opcional); sem `device_id`, usa apenas os soft bounds.

## Segurança

- Credenciais via `.env` (backend) e `secrets.h` (firmware) — **não versionados**.
- Endpoints de escrita exigem `X-API-Key`.
- CORS configurável (`CORS_ORIGINS`).
- O firmware usa HTTP puro por ser rede local; para produção, usar HTTPS.

## Evolução prevista

- XGBoost como modelo opcional
- Fila de mensagens para múltiplos ESP32
- Endpoints de exportação (PDF/JSON) e relatórios
