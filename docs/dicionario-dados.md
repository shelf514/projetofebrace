# Dicionário de dados — AquaSense AI

## Leituras (`readings`)

| Campo | Tipo | Unidade | Exemplo | Notas |
| ----- | ---- | ------- | ------- | ----- |
| `timestamp` | ISO 8601 UTC (`Z`) | — | `2026-09-01T14:00:00Z` | Backend grava em UTC; dashboard exibe `pt-BR` local |
| `device_id` | string `^[A-Za-z0-9_-]+$`, ≤ 64 | — | `AQUASENSE-001` | `AQUASENSE-DEMO`/`AQUASENSE-SIM` = MOCK (selo DEMO no dashboard) |
| `temperature` | float | °C | `25.7` | DS18B20; hard bounds firmware −5…45 |
| `turbidity` | float ≥ 0 | NTU | `12.4` | SEN0189; referência 5 NTU (potável, Portaria 888) |
| `tds` | float ≥ 0 | ppm (= mg/L) | `238.0` | SEN0244; referência 1000 mg/L (Portaria 888) |
| `prediction` | string \| null | — | `boa` | Saída do RandomForest; `null` sem modelo |
| `prediction_probability` | float 0–1 \| null | — | `0.92` | Confiança da classe prevista |
| `anomaly` | bool | — | `false` | Isolation Forest por dispositivo + soft bounds + z-score MAD |

## Dispositivos (`devices`)

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | string PK | = `device_id` das leituras |
| `status` | `online` ≤ 300 s sem leitura → `offline` | Calculado em leitura (`computed_status()`); coluna `unknown` = nunca viu |
| `last_seen` | UTC \| null | Último `POST /api/readings` aceito |

## Convenções

- Timestamps sempre UTC no transporte/DB; conversão local só na exibição.
- Leituras de `AQUASENSE-DEMO` são sintéticas (simulador `DEMO_SIMULATOR_*`) —
  nunca apresentar como dado científico real (ver `docs/methodology.md`).
- Export CSV (`GET /api/readings/export`): colunas
  `timestamp,device_id,temperature,turbidity,tds,prediction,prediction_probability,anomaly`.
