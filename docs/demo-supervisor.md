# Guia de demonstração — AquaSense AI

Página única para apresentar o projeto sem instalar nada em máquinas/tablets de terceiros.

## O que mostrar

1. **Site aberto no navegador — https://aquasense-ai.onrender.com**:
   - Dashboard com temperatura, turbidez e TDS em gráficos.
   - **Dados chegando em tempo real**: o servidor gera uma leitura DEMO a cada ~40 s
     (selo "DEMO — dados simulados" no dashboard). Espere alguns segundos e o gráfico
     se moverá sozinho via WebSocket.
   - Abas: Histórico, Dispositivo, IA (modelo carregado + confusão) e "Como funciona".
   - O ícone ⚙ troca o endereço do backend sem rebuild (rede local da feira).

2. **APK Android installável** — baixe em GitHub → *Releases* (`nightly`) ou em *Actions → Build APK Android → artifact*:
   - Instale no smartphone, abra e aponte o ⚙ para o site hospedado
     (o APK já vem apontando para ele se a variável `APK_API_URL` estiver configurada).

3. **(Opcional) ESP32 real** — o firmware envia para o mesmo backend hospedado:
   - `firmware/esp32/include/secrets.h` com
      `API_URL = https://aquasense-ai.onrender.com/api/readings`
     e a `API_KEY` do servidor (Render → Environment).

## Cartões rápidos (para o estande)

| Item | Link | Observação |
| ---- | ---- | ---------- |
| Site ao vivo | https://aquasense-ai.onrender.com | Abrir ~30 s antes; o plano gratuito "dorme" em ~15 min ocioso |
| APK Android | GitHub → Releases (`nightly`) | Instalação direta no celular |
| API docs | https://aquasense-ai.onrender.com/docs | Swagger interativo (mostra as rotas do ESP32) |
| Repositório | https://github.com/shelf514/projetofebrace | Código, firmware e documentação |

## Mensagens padrão

- **O que é:** monitoramento da qualidade da água (temperatura, turbidez, TDS) de baixo custo,
  com ESP32 + IA (RandomForest/Isolation Forest) rodando no backend.
- **Selo DEMO:** todos os dados exibidos durante a apresentação são sintéticos (declarados no
   próprio dashboard), cumprindo a exigência de transparência científica.

## Se algo der errado

- Site demorou para abrir? O plano gratuito do Render acorda sozinho em ~30 s — atualize a página.
- Sem dados no gráfico? Verifique se o simulador está ativo: Render → seu serviço → Environment →
  `DEMO_SIMULATOR_ENABLED=1`; depois redeploy (Deploy → Deploy latest commit).
- APK não abre? Permita "fontes desconhecidas" na instalação (configuração padrão de testes).