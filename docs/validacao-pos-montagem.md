# Validação pós-montagem — AquaSense AI

Checklist passo a passo para conferir o hardware **antes** de operar o sistema.
Siga na ordem: qualquer falha aqui evita problemas depois.

> Segurança: ESP32 e placas nunca entram em contato com a água.
> Somente as sondas (DS18B20, turbidez, TDS) ficam submersas.

---

## 1. Inspeção visual

- [ ] Conexões firmes: protoboard e jumpers sem fios soltos.
- [ ] DS18B20: pino data no `PIN_ONE_WIRE` (GPIO 4) com resistor pull-up de 4,7 kΩ entre data e VCC (3,3 V).
- [ ] Turbidez: pino de sinal no `PIN_TURBIDITY_ADC` (GPIO 34), VCC e GND corretos.
- [ ] TDS: pino de sinal no `PIN_TDS_ADC` (GPIO 35), VCC e GND corretos.
- [ ] Nenhum componente energizado em contato com água.
- [ ] Fonte de alimentação com corrente suficiente (ESP32 + sensores).

## 2. Alimentação

- [ ] Plugar o ESP32 na USB e abrir o Monitor Serial (115200 baud).
- [ ] A placa deve iniciar e mostrar `AquaSense AI - dispositivo <ID>`.

## 3. Modo calibração (obrigatório na primeira vez)

1. Em `firmware/esp32/include/config.h`, defina `CALIBRATION_MODE 1`.
2. Compile e grave (`pio run -t upload`).
3. Coloque a sonda na água de referência (ex.: água filtrada/mineral).
4. Observe o Monitor Serial a cada segundo:
   - **Temperatura**: valor entre ~15 e ~30 °C. Se aparecer `SEM SENSOR`,
     confira o DS18B20 e o pull-up.
   - **Turbidez**: ADC e tensão devem mudar quando a água turva (ex.: leite em
     pequenas quantidades) é agitada. Anote ADC em água limpa.
   - **TDS**: ADC deve subir em água salgada e ser baixo em água destilada.
5. Se os valores parecerem descalibrados, ajuste os coeficientes
   (`TURBIDITY_A/B/C`, `TDS_SCALE`) em `config.h`.
6. Volte `CALIBRATION_MODE 0`, grave e reinicie.

## 4. Wi-Fi e envio

- [ ] Em `secrets.h`, confira `WIFI_SSID`/`WIFI_PASSWORD` e `API_URL`
      (use o IP da máquina com o backend, ex.: `http://192.168.0.10:8000/api/readings`).
- [ ] `API_KEY` no firmware igual à do `.env` do backend.
- [ ] Ligar: o LED deve acender (ok). Piscando rápido = tentando conectar.
- [ ] No Serial deve aparecer `Wi-Fi conectado. IP: ...`.
- [ ] Após 60 s, deve aparecer `Leitura enviada (HTTP 201)`.
- [ ] No dashboard (frontend), a leitura deve aparecer na hora e o selo **AO VIVO**.

## 5. Falhas comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| `SEM SENSOR` no DS18B20 | Fio invertido ou sem pull-up | Reconfira GPIO 4, VCC, GND e resistor 4,7 kΩ |
| LED nunca acende | ESP32 sem energia | Trocar cabo USB/fonte |
| `Falha ao conectar no Wi-Fi` | SSID/senha errados ou sinal fraco | Conferir `secrets.h`; aproximar do roteador |
| `HTTP 401` no envio | API key diferente | Igualar `API_KEY` e o `.env` do backend |
| `HTTP 422` no envio | Leituras fora dos limites físicos | Recalibrar (passo 3) |
| Nada aparece no dashboard | Backend não rodando ou IP errado | Rodar backend; testar `curl` do `API_URL` |
| Leituras sem tempo real (selo POLLING) | Backend antigo ou firewall | Usar a versão com `/ws/readings` |

## 6. Teste de queda de rede (backoff)

- [ ] Com o sistema rodando, desconecte o roteador (ou pare o backend).
- [ ] O firmware deve tentar reenviar com esperas crescentes (5 s → 10 s → 20 s → 60 s máx).
- [ ] Ao restabelecer a rede, a próxima leitura válida é enviada e o intervalo volta ao normal.
