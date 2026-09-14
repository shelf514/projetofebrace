#ifndef SECRETS_H
#define SECRETS_H

// ============================================================
// CREDENCIAIS - NAO COMITAR ESTE ARQUIVO
// Copie secrets.example.h para secrets.h e preencha os valores.
// Na feira: use o IP do notebook na rede local (ex.: http://192.168.0.10:8000/api/readings)
// Producao Render: https://SEU-SITE.onrender.com/api/readings  (requer WiFiClientSecure no firmware para https)
// O firmware valida em setup() se WIFI_SSID/API_KEY ainda estao com placeholder.
// ============================================================

// Wi-Fi
#define WIFI_SSID "SEU_WIFI_SSID"
#define WIFI_PASSWORD "SUA_SENHA_WIFI"

// Backend (na feira, use o IP do notebook na rede local)
#define API_URL "http://192.168.0.10:8000/api/readings"

// Chave de API configurada no backend (.env -> API_KEY) - TROQUE de "change-me"
#define API_KEY "change-me"

#endif
