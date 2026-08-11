# Hardware do AquaSense AI

## Lista de componentes

| Componente        | Função              | Conexão ESP32 |
| ----------------- | ------------------- | ------------- |
| ESP32 DevKit      | Microcontrolador    | —             |
| DS18B20 (waterproof) | Temperatura (°C) | GPIO 4 (OneWire, com resistor pull-up 4,7 kΩ) |
| Sensor de turbidez (SEN0189 ou similar) | Turbidez (NTU) | GPIO 34 (ADC, analógico) |
| Sensor TDS (DFRobot ou similar) | Sólidos dissolvidos (ppm) | GPIO 35 (ADC, analógico) |
| LED onboard       | Indicador de status | GPIO 2        |
| Fonte 5 V         | Alimentação         | VIN            |

## Diagrama elétrico (resumo)

```
        VIN (5V) ──────────── VCC sensores
          │
ESP32 ──── GND ────────────── GND sensores
          │
GPIO 4 ──── [4,7kΩ] ── VCC ── DS18B20 data (parasitic/regular)
GPIO 34 ──── analog ───────── Turbidez (OUT)
GPIO 35 ──── analog ───────── TDS (OUT)
```

- O DS18B20 requer pull-up de 4,7 kΩ entre DATA e VCC.
- O sensor TDS não deve ser alimentado com 5 V quando os ADC do ESP32
  esperam 3,3 V — use divisor de tensão ou alimente o módulo em 3,3 V
  conforme o datasheet do módulo.
- Use o pino 34/35 porque são ADC de entrada **somente**, sem saída interna.

## Segurança da montagem (IMPORTANTE)

1. **Nenhuma placa eletrônica entra em contato com a água.**
   - ESP32, protoboard, sensores (parte eletrônica) e fiações ficam fora da água.
   - Somente as **sondas** (ponta metálica do DS18B20 waterproof, ponteira
     do sensor de turbidez, placa de aço inox do TDS) ficam submersas.
2. Use caixa de proteção (acrílico/plástico) para a eletrônica.
3. Vedações nos pontos de passagem de cabos (resina, silicone ou grommets).
4. Não submerja conectores JST/duPont.
5. A água deve ser manuseada como potencialmente contaminada: luvas, e o
   sistema deve ser lavado/descontaminado entre medições de amostras
   diferentes (procedimento descrito em methodology.md).

## Calibração

As fórmulas usadas no firmware (`include/config.h`) são as de referência dos
fabricantes e **devem ser calibradas** com padrões conhecidos antes de gerar
dados científicos:

- **Turbidez (SEN0189):** NTU = A·V² + B·V + C (A=-1120,4; B=5742,3; C=-4352,9).
  Calibre com solução padrão de formazina ou água destilada.
- **TDS (DFRobot):** TDS = (133,42·Vc³ − 255,86·Vc² + 857,39·Vc) · 0,5,
  com Vc = V/(1 + 0,02·(T−25)). Calibre com solução de condutividade conhecida.
- **Temperatura:** o DS18B20 é calibrado de fábrica (±0,5 °C).

Cada calibração deve ser registrada em `docs/methodology.md` (padrões,
datas, equipamentos).

## Indicador LED

| Estado               | Comportamento            |
| -------------------- | ------------------------ |
| Conectando Wi-Fi     | Pisca rápido (500 ms)    |
| Conexão + leitura OK | Aceso                    |
| Falha (Wi-Fi/envio)  | Pisca lento (2 s)        |

## Validação no firmware

Antes de enviar, o firmware rejeita valores fora dos limites físicos
(`config.h`): temperatura −5..45 °C, turbidez 0..1000 NTU, TDS 0..2000 ppm.
Leituras inválidas são descartadas e logadas no Serial (115200 baud).
