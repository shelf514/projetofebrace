#ifndef CONFIG_H
#define CONFIG_H

// ============================================================
// Configuracoes do AquaSense AI (ESP32)
// Edite os valores abaixo conforme a montagem do seu projeto.
// Credenciais (Wi-Fi / API key) ficam em secrets.h (nao versionado).
// ============================================================

#include "secrets.h"

// Guard: o pre-processador C nao compara strings, entao a validacao de
// credenciais placeholder (WIFI_SSID / API_KEY em secrets.h) e feita em
// runtime no setup() em main.cpp — NAO adicione checagem #if de string aqui.

// Identificacao do dispositivo
#define DEVICE_ID "AQUASENSE-001"

// Intervalo entre leituras em segundos
#define MEASUREMENT_INTERVAL_SEC 60

// Timeout das requisicoes HTTP em milissegundos
#define HTTP_TIMEOUT_MS 10000

// ------------------------------------------------------------
// Modo CALIBRACAO (use antes da primeira operacao!)
// 1 = imprime valores brutos no Monitor Serial a cada segundo
//     (sem Wi-Fi, sem envio). Ajuste os coeficientes abaixo.
// 0 = operacao normal (coleta e envia para o backend)
// ------------------------------------------------------------
#define CALIBRATION_MODE 0

// Retry com backoff exponencial quando o envio HTTP falha
#define RETRY_BACKOFF_MIN_MS 5000    // primeira espera apos falha
#define RETRY_BACKOFF_MAX_MS 60000   // espera maxima entre tentativas


// ---- Pinos ----
#define PIN_LED_STATUS 2        // LED onboard do DevKit (pisca: conexao; aceso: ok; apagado: falha)
#define PIN_ONE_WIRE 4          // DS18B20 (data)
#define PIN_TURBIDITY_ADC 34    // Saida analogica do sensor de turbidez
#define PIN_TDS_ADC 35          // Saida analogica do sensor TDS

// ---- Calibracao dos sensores (ajuste com agua limpa/conhecida) ----
// Formula SEN0189 aproximada: NTU = A*V^2 + B*V + C, V = tensao (0..3.3V)
#define TURBIDITY_A -1120.4f
#define TURBIDITY_B 5742.3f
#define TURBIDITY_C -4352.9f

// TDS (DFRobot): TDS = (133.42*Vc^3 - 255.86*Vc^2 + 857.39*Vc) * TDS_SCALE
#define TDS_SCALE 0.5f
#define TDS_REF_VOLTAGE 3.3f
#define ADC_RESOLUTION 4095

// ---- Amostragem / validacao ----
#define SAMPLE_COUNT 10              // leituras por coleta (media)
#define SENSOR_SAMPLE_DELAY_MS 500   // intervalo entre amostras individuais (delay de amostragem)
#define SENSOR_STALE_MS SENSOR_SAMPLE_DELAY_MS  // alias legado (nao usar em codigo novo)

// Limites fisicos (rejeitam leituras absurdas ANTES do envio)
#define TEMP_MIN -5.0f
#define TEMP_MAX 45.0f
#define TURBIDITY_MIN 0.0f
#define TURBIDITY_MAX 1000.0f
#define TDS_MIN 0.0f
#define TDS_MAX 2000.0f

// Timeout de reconexao Wi-Fi em milissegundos
#define WIFI_CONNECT_TIMEOUT_MS 20000

#endif
