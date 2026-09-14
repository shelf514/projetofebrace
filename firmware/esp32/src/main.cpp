// ============================================================
// AquaSense AI - firmware ESP32 (FEBRACE)
//
// Coleta temperaturas (DS18B20), turbidez e TDS, valida as
// leituras e envia via HTTP POST para o backend FastAPI.
//
// IMPORTANTE: o ESP32 NAO executa o modelo de IA; apenas coleta,
// valida e envia os dados. A IA roda no backend.
//
// Seguranca da montagem: placas eletronicas e ESP32 nunca entram
// em contato com a agua; apenas as sondas ficam submersas.
// ============================================================

#include <Arduino.h>
#include <ArduinoJson.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <WiFi.h>

#include "config.h"

OneWire oneWire(PIN_ONE_WIRE);
DallasTemperature temperatureSensor(&oneWire);

// ---- estados do LED: pisca rapido = conectando, aceso = ok, pisca lento = falha ----
enum LedState { LED_CONNECTING, LED_OK, LED_ERROR };

unsigned long lastSendAt = 0;
unsigned long backoffUntil = 0;
unsigned long retryDelayMs = RETRY_BACKOFF_MIN_MS;
bool wifiConnected = false;

// ------------------------------------------------------------
// LED
// ------------------------------------------------------------
void setLedState(LedState state) {
  switch (state) {
    case LED_CONNECTING:
      digitalWrite(PIN_LED_STATUS, millis() % 500 < 250 ? HIGH : LOW);
      break;
    case LED_OK:
      digitalWrite(PIN_LED_STATUS, HIGH);
      break;
    case LED_ERROR:
      digitalWrite(PIN_LED_STATUS, millis() % 2000 < 150 ? HIGH : LOW);
      break;
  }
}

// ------------------------------------------------------------
// Wi-Fi
// ------------------------------------------------------------
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }
  Serial.print("Conectando ao Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWi-Fi conectado. IP: %s\n", WiFi.localIP().toString().c_str());
    return true;
  }
  Serial.println("\nFalha ao conectar no Wi-Fi.");
  return false;
}

// ------------------------------------------------------------
// Leituras analogicas com media simples
// ------------------------------------------------------------
float readAnalogAverageSampleCount(int pin, float maxVoltage, int sampleCount) {
  float sum = 0.0f;
  for (int i = 0; i < sampleCount; i++) {
    sum += analogRead(pin);
    delay(SENSOR_STALE_MS);
  }
  float average = sum / sampleCount;
  return (average / ADC_RESOLUTION) * maxVoltage;
}

float readAnalogAverage(int pin, float maxVoltage) {
  return readAnalogAverageSampleCount(pin, maxVoltage, SAMPLE_COUNT);
}

// ------------------------------------------------------------
// Sensores
// ------------------------------------------------------------
float readTemperatureC() {
  temperatureSensor.requestTemperatures();
  float value = temperatureSensor.getTempCByIndex(0);
  if (value == DEVICE_DISCONNECTED_C || isnan(value)) {
    Serial.println("ERRO: DS18B20 nao respondeu");
    return NAN;
  }
  return value;
}

// Formula SEN0189: NTU = A*V^2 + B*V + C
float readTurbidityNtu() {
  float voltage = readAnalogAverage(PIN_TURBIDITY_ADC, TDS_REF_VOLTAGE);
  float ntu = TURBIDITY_A * voltage * voltage + TURBIDITY_B * voltage + TURBIDITY_C;
  return ntu < 0.0f ? 0.0f : ntu;
}

// Formula DFRobot com compensacao de temperatura
float readTdsPpm(float temperatureC) {
  float voltage = readAnalogAverage(PIN_TDS_ADC, TDS_REF_VOLTAGE);
  float compensationVoltage = voltage / (1.0f + 0.02f * (temperatureC - 25.0f));
  float tds =
      (133.42f * compensationVoltage * compensationVoltage * compensationVoltage -
       255.86f * compensationVoltage * compensationVoltage +
       857.39f * compensationVoltage) *
      TDS_SCALE;
  return tds < 0.0f ? 0.0f : tds;
}

// ------------------------------------------------------------
// Validacao fisica (limites hard) - rejeita absurdos
// ------------------------------------------------------------
bool isValidReading(float temperature, float turbidity, float tds) {
  return !isnan(temperature) && !isnan(turbidity) && !isnan(tds) &&
         temperature >= TEMP_MIN && temperature <= TEMP_MAX &&
         turbidity >= TURBIDITY_MIN && turbidity <= TURBIDITY_MAX &&
         tds >= TDS_MIN && tds <= TDS_MAX;
}

// ------------------------------------------------------------
// Envio HTTP POST
// ------------------------------------------------------------
bool sendReading(float temperature, float turbidity, float tds) {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["turbidity"] = turbidity;
  doc["tds"] = tds;
  doc["timestamp"] = "";  // backend usa o horario de recepcao

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(API_URL);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);

  int statusCode = http.POST(payload);
  bool ok = statusCode == 201 || statusCode == 200;

  if (ok) {
    Serial.printf("Leitura enviada (HTTP %d): temp=%.2f C, turbidez=%.2f NTU, TDS=%.1f ppm\n",
                  statusCode, temperature, turbidity, tds);
  } else {
    Serial.printf("ERRO no envio: HTTP %d - %s\n", statusCode, http.errorToString(statusCode).c_str());
  }
  http.end();
  return ok;
}

// ------------------------------------------------------------
// Setup / Loop
// ------------------------------------------------------------
#if CALIBRATION_MODE

// ------------------------------------------------------------
// Modo CALIBRACAO: imprime valores brutos para ajuste dos sensores.
// Nao conecta no Wi-Fi e nao envia nada ao backend.
// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  analogReadResolution(12);
  temperatureSensor.begin();
  Serial.println("==========================================");
  Serial.println(" AQUASENSE AI - MODO CALIBRACAO");
  Serial.println(" (CALIBRATION_MODE=1 em config.h)");
  Serial.println("------------------------------------------");
  Serial.println("1) Coloque a sonda na agua de referencia.");
  Serial.println("2) Observe ADC e tensao de cada sensor.");
  Serial.println("3) Ajuste os coeficientes em config.h.");
  Serial.println("4) Volte CALIBRATION_MODE para 0 e grave.");
  Serial.println("==========================================");
}

void loop() {
  unsigned long started = millis();
  float temperature = readTemperatureC();

  // No modo calibracao usamos poucas amostras para o ciclo ficar ~1s
  const int calibrationSamples = 3;
  float turbidityAdc = readAnalogAverageSampleCount(PIN_TURBIDITY_ADC, TDS_REF_VOLTAGE, calibrationSamples);
  float turbidityVoltage = turbidityAdc;
  float ntu = TURBIDITY_A * turbidityVoltage * turbidityVoltage +
              TURBIDITY_B * turbidityVoltage + TURBIDITY_C;

  float tdsVoltage = readAnalogAverageSampleCount(PIN_TDS_ADC, TDS_REF_VOLTAGE, calibrationSamples);
  float compensationVoltage = tdsVoltage / (1.0f + 0.02f * (temperature - 25.0f));
  float tds = (133.42f * compensationVoltage * compensationVoltage * compensationVoltage -
               255.86f * compensationVoltage * compensationVoltage +
               857.39f * compensationVoltage) *
              TDS_SCALE;

  Serial.println("------------------------------------------");
  if (!isnan(temperature)) {
    Serial.printf("Temperatura: %.2f C\n", temperature);
  } else {
    Serial.println("Temperatura: SEM SENSOR (cheque o DS18B20)");
  }
  Serial.printf("Turbidez: ADC=%.0f V=%.3f -> NTU calculado=%.2f\n",
                turbidityAdc, turbidityVoltage, ntu < 0 ? 0 : ntu);
  Serial.printf("TDS:      ADC=%.0f V=%.3f (comp %.3f) -> ppm calculado=%.1f\n",
                tdsVoltage, tdsVoltage, compensationVoltage, tds < 0 ? 0 : tds);

  unsigned long elapsed = millis() - started;
  if (elapsed < 1000UL) {
    delay(1000UL - elapsed);
  }
}

#else

void setup() {
  Serial.begin(115200);
  delay(500);

  // Validacao de credenciais placeholder: evita flash sem configurar secrets.h
  if (String(WIFI_SSID) == "SEU_WIFI_SSID" || String(WIFI_SSID).length() == 0) {
    Serial.println("ERRO: WIFI_SSID nao configurado em secrets.h - troque SEU_WIFI_SSID");
    while (true) { setLedState(LED_ERROR); delay(300); }
  }
  if (String(API_KEY) == "change-me") {
    Serial.println("AVISO: API_KEY ainda e 'change-me' - troque em secrets.h e no backend .env");
  }
  // HTTPS em API_URL requer WiFiClientSecure
  if (String(API_URL).startsWith("https://")) {
    Serial.println("AVISO: API_URL usa https:// - garanta que HTTPClient esta com WiFiClientSecure (setInsecure) se cert falhar");
  }

  pinMode(PIN_LED_STATUS, OUTPUT);
  analogReadResolution(12);

  temperatureSensor.begin();

  Serial.printf("AquaSense AI - dispositivo %s\n", DEVICE_ID);
  if (temperatureSensor.getDeviceCount() == 0) {
    Serial.println("AVISO: nenhum sensor DS18B20 encontrado no pino OneWire.");
  }

  wifiConnected = connectWiFi();
}

void loop() {
  setLedState(wifiConnected ? LED_OK : LED_ERROR);

  if (!connectWiFi()) {
    wifiConnected = false;
    setLedState(LED_CONNECTING);
    delay(2000);
    return;
  }
  wifiConnected = true;

  if (millis() < backoffUntil) {
    return;  // aguardando a proxima tentativa de envio (backoff)
  }
  if (millis() - lastSendAt < (unsigned long)MEASUREMENT_INTERVAL_SEC * 1000UL) {
    return;
  }
  lastSendAt = millis();

  float temperature = readTemperatureC();
  float turbidity = readTurbidityNtu();
  float tds = readTdsPpm(temperature);

  Serial.printf("Leitura bruta: temp=%.2f C, turbidez=%.2f NTU, TDS=%.1f ppm\n",
                temperature, turbidity, tds);

  if (!isValidReading(temperature, turbidity, tds)) {
    Serial.println("Leitura invalida (fora dos limites fisicos) - descartada.");
    setLedState(LED_ERROR);
    return;
  }

  if (!sendReading(temperature, turbidity, tds)) {
    // Backoff exponencial: falha com frequencia = problema real, nao inundar a rede
    setLedState(LED_ERROR);
    backoffUntil = millis() + retryDelayMs;
    Serial.printf("Proxima tentativa em %lu s.\n", retryDelayMs / 1000UL);
    retryDelayMs = retryDelayMs * 2 > RETRY_BACKOFF_MAX_MS ? RETRY_BACKOFF_MAX_MS : retryDelayMs * 2;
  } else {
    retryDelayMs = RETRY_BACKOFF_MIN_MS;
    setLedState(LED_OK);
  }
}

#endif
