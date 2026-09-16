# Calibração dos sensores — AquaSense AI (FEBRACE)

> Sem esta etapa, os coeficientes em `firmware/esp32/include/config.h` são os
> valores default de fabricante (SEN0189 @ 5 V / Arduino) e **não valem para o
> ESP32 @ 3,3 V**. A banca vai perguntar "como calibraram?" — a resposta está
> neste documento + na planilha `data/raw/calibration_log.csv`.

## 1. Pré-requisitos

- Firmware com `CALIBRATION_MODE 1` em `config.h`, gravado no ESP32.
- `platformio device monitor -b 115200` aberto (modo calibração imprime
  ADC bruto (0–4095), tensão (V) e valor convertido a cada ~1 s, sem Wi-Fi/envio).
- Águas de referência: destilada (0 NTU), filtrada, e 2–3 diluições de padrão
  (ex.: leite/formazina para turbidez; solução salina de condutividade conhecida
  para TDS). Termômetro de referência para o DS18B20 (±0,5 °C de fábrica).

## 2. Procedimento

1. Submerja **somente as sondas** (placas/ESP32 nunca tocam água).
2. Para cada padrão: aguarde 60 s (estabilização), anote `ADC_medio (n=10)`,
   `V_medio`, `T_agua` e o valor de referência do padrão.
3. Turbidez: ajuste `TURBIDITY_A/B/C` por regressão quadrática `NTU = A·V² + B·V + C`
   sobre os pares `(V_medio, NTU_padrao)`. Mínimo 3 pontos.
4. TDS: confira `TDS_SCALE` contra o condutivímetro (compensação de temperatura
   já aplicada no firmware: `Vc = V / (1 + 0,02·(T − 25))`).
5. Volte `CALIBRATION_MODE` para `0`, grave, commit os coeficientes finais com
   data + foto da montagem.

## 3. Registro (obrigatório)

Preencha `data/raw/calibration_log.csv` (template abaixo). Semanalmente na feira,
repita 1 ponto (água filtrada) e anote deriva.

```csv
data,padrao,referencia_unidade,V_medio_n10,T_agua_C,ADC_medio,leitura_convertida,operador,obs
2026-09-01,destilada,0 NTU,2.412,25.3,2945,0.4,equipe,baseline
2026-09-01,leite 1:100,40 NTU,1.980,25.4,2418,39.2,equipe,regressao ponto 2
2026-09-01,NaCl 342ppm,342 ppm,1.150,25.2,1405,335.0,equipe,TDS_SCALE 0.5 ok
```

## 4. Validação laboratorial (para o relatório)

- Triplicata por ponto: média ± DP, CV% < 10% para aceitar o ponto.
- Compare contra turbidímetro/condutivímetro certificado quando disponível;
  registre equipamento + certificado em `docs/methodology.md`.
- Declare no pôster: faixa calibrada (ex.: 0–200 NTU, 0–1000 ppm, 15–30 °C);
  fora da faixa, o dashboard marca anomalia mas o valor é **estimativa**.

## 5. BOM — lista de materiais (custo aproximado, BRL 2026)

| Item | Modelo | Fornecedor típico | Qtd | Unit. ~ | Total ~ |
| ---- | ------ | ----------------- | --- | ------- | ------- |
| ESP32 DevKit | ESP32-WROOM-32 | Mercado Livre/AliExpress | 1 | 45 | 45 |
| DS18B20 waterproof | DS18B20 + cabo 1 m | Idem | 1 | 25 | 25 |
| Sensor turbidez | SEN0189 | DFRobot/revenda | 1 | 90 | 90 |
| Sensor TDS | DFRobot SEN0244 | DFRobot/revenda | 1 | 70 | 70 |
| Protoboard + jumpers + divisor resistivo | — | Loja local | 1 | 30 | 30 |
| Fonte 5 V / case estanque p/ eletrônica | — | Loja local | 1 | 40 | 40 |
| **Total estimado** | | | | | **~300** |

Datasheets: SEN0189 (DFRobot wiki), SEN0244 (DFRobot wiki), DS18B20 (Maxim).
Anote versões/links usados em `docs/methodology.md`.
