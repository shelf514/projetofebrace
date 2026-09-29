# Migração para Neon — Permanência do Banco de Dados

## Por que migrar?

O Postgres free do Render **expira 30 dias após criação** e é deletado após 14 dias de graça. O Neon free é **permanente** (0.5 GB, 100 CU-hours/mês, sem cartão de crédito).

## Passo a passo

### 1. Criar conta e projeto no Neon

1. Acesse [neon.tech](https://neon.tech) e crie conta (GitHub login recomendado)
2. Clique **New Project**
3. Nome: `aquasense`
4. Region: escolha a mais próxima (South America ou US East)
5. Copie a **Connection String** (formato `postgresql://user:pass@ep-xxxx.region.aws.neon.tech/aquasense`)

### 2. Migrar dados existentes (se houver)

Se o banco atual do Render já tem dados reais do ESP32:

```bash
# No Render Dashboard -> aquasense-db -> Shell, ou localmente com psql:
pg_dump "$DATABASE_URL_ATUAL" > backup.sql

# Restaurar no Neon:
psql "$DATABASE_URL_NEON" < backup.sql
```

### 3. Configurar no Render

1. Render Dashboard → serviço `aquasense-ai-fokz` → **Environment**
2. Encontre `DATABASE_URL` (atualmente vem do `aquasense-db` interno)
3. **Editar** → cole a URL do Neon → **Save Changes**
4. **Deletar** o serviço `aquasense-db` (Postgres free interno) para não expirar
5. **Deploy** → **Deploy latest commit** (ou aguarde auto-deploy do GitHub)

### 4. Testar

```bash
# Health check
curl https://aquasense-ai-fokz.onrender.com/api/health

# Ver última leitura (deve retornar DEMO ou real)
curl https://aquasense-ai-fokz.onrender.com/api/readings/latest

# Enviar leitura teste do ESP32 (substitua API_KEY e valores)
curl -X POST https://aquasense-ai-fokz.onrender.com/api/readings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_API_KEY" \
  -d '{"device_id":"AQUASENSE-001","temperature":25.5,"turbidity":12.3,"tds":280}'
```

### 5. Verificar persistência

1. Abra o dashboard `https://aquasense-ai-fokz.onrender.com`
2. Aguarde ~40s para ver leitura DEMO chegar via WebSocket
3. Envie 1 leitura real do ESP32
4. **Reinicie** o serviço no Render (Deploy → Restart)
5. Verifique se a leitura real ainda está em `/api/readings/latest`

## Variáveis de ambiente finais no Render

| Variável | Valor |
|----------|-------|
| `API_KEY` | (gerada automaticamente — copiar para `firmware/esp32/include/secrets.h`) |
| `DATABASE_URL` | `postgresql://...` do Neon |
| `DEMO_SIMULATOR_ENABLED` | `1` (desliga sozinho quando ESP32 real envia) |
| `DEMO_SIMULATOR_INTERVAL_SEC` | `40` |
| `CORS_ORIGINS` | `https://aquasense-ai-fokz.onrender.com,http://localhost:5173,http://localhost:8000` |
| `ENV` | `production` |

## Backup local (recomendado para a feira)

```bash
# Exportar dados do Neon
psql "$DATABASE_URL_NEON" -c "\copy (SELECT * FROM readings) TO 'backup.csv' CSV HEADER"

# Ou backup completo
pg_dump "$DATABASE_URL_NEON" > aquasense-backup-$(date +%Y%m%d).sql
```

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Site demora para abrir | Plano free dorme após 15min — abrir 1min antes |
| `DATABASE_URL` não conecta | Verificar se URL está completa (inclui senha) |
| Dados somem após restart | Confirmar que `DATABASE_URL` aponta para Neon, não SQLite |
| ESP32 não envia | Verificar `API_KEY` e `API_URL` no `secrets.h` |
