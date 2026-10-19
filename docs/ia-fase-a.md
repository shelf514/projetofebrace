# IA Fase A — DST + Fuzzy + Follow-up (sem novo modelo)

> Status: especificação executada. Offline-first preservado (regras locais, sem rede).

## 1. Objetivo

Coesão multi-turno sem novo modelo: lembrar espécie/parâmetros entre turnos,
extrair slots de uma frase (`posso colocar betta com coridora em 60L?` → 3 slots),
e perguntar só o que falta (1 follow-up por resposta).

## 2. Contrato `DialogueState`

```json
{
  "especie": "betta | null",
  "segunda_especie": "coridora | null",
  "volume_l": 60,
  "ph": 7.0, "gh": 6, "temp": 26.5, "tds": 250, "turbidity": 8,
  "companheiros": ["coridora"],
  "last_intent": "compat | ph | volume | diagnostico | dieta | ..."
}
```

Regras de merge (`backend/app/services/dialogue_state.py`):

- Menção nova sobrescreve campo; turno sem menção herda do estado
  (`e ele?` / `e em 60L?` / `e com X?` herdam `especie`).
- `companheiros`: acumula com dedup, max 3.
- Valor fora da faixa do schema (`ph 0-14`, `gh 0-50`, `volume 1-10000`)
  não entra no estado.
- Estado persistido em `_CONVERSATIONS[conv_id]["state"]` + `updated_at`;
  `GET /api/chat/history/{id}` retorna `state` (campo novo, compatível).

## 3. Normalização + extração (por turno)

- `lower → strip → unicodedata sem acento → plural/sinônimo`:
  `bettas→betta`, `neons→neon`, `coridoras→coridora`, `kinguio→kingui`,
  `acara-disco/acara disco→acaradisco`, `tetra→tetra`.
- Espécie: exato `word-boundary` primeiro, senão `difflib ≥0.82`
  contra `aquarismo_service.list_especies()` + sinônimos.
- Parâmetros (regex, validados antes de salvar):
  `(\d+[.,]?\d*)\s?(L|litros?)` → `volume_l`;
  `pH\s?(\d+[.,]\d+)` → `ph`;
  `(\d+[.,]?\d*)\s?°?\s?C` com contexto `temp/temperatura` → `temp`;
  `TDS\s?(\d+)` → `tds`; `GH\s?(\d+)` → `gh`.
- Compat: ordem das espécies = ordem de aparição na frase
  (não ordem de `list_especies()`); `payload.companheiros` é fallback.

## 4. Bugs corrigidos (referência)

- `chat.py:_detect_especie` regex exata → extrator fuzzy (A3).
- `has_specific_intent` / `temp ` com espaço → regex `\btemp\b|temperatura|quente|frio`.
- `elif temp and especie` inalcançável quando `fish` existe → `if` independente.
- Compat usava ordem de `list_especies()` → ordem de aparição.
- `should_diag` exigia keyword (`tds/ph/...`) → diagnostica sempre que houver
  parâmetros + (`especie` ou pergunta sobre água).
- `_openai_reply` ecoava `payload.especie=None` → retorna espécie detectada+estado.

## 5. Follow-up (1 pergunta por resposta, curto)

- Compat sem 2ª espécie → `Qual a segunda espécie? Ex.: '...com coridora?'`
- Volume sem espécie → `Para qual espécie?`
- Diagnóstico sem parâmetros e sem leitura DB → `Qual pH/GH/volume? (ex.: pH 7.0, 60L)`
- Nunca fallback genérico quando há estado parcial.

## 6. `sources` (prepara Fase B / RAG lexical)

Resposta cita `Seriously Fish — Betta: pH 6.5-7.5` com valor exato da base;
fora da base → `não está na base + orientação geral`.
`ChatResponse.state` + `followup` (opcionais, compatíveis);
`model_used: regras | slm-local | openai` (SLM na Fase C).

## 7. Casos golden (10 mínimos, em `backend/tests/chat_golden.jsonl`)

1. `pH ideal para betta?` → `6.5-7.5`, `especie=betta`, fonte pH.
2. `e para neon?` (mesmo `conv_id`) → troca para `neon 6.0-7.0`.
3. `e ele come o quê?` → herda `neon` + dieta.
4. `posso colocar betta com coridora em 60L?` → 3 slots + veredito compat.
5. `bettas com kinguio é ok?` → fuzzy `betta+kingui`.
6. `e em 60L?` (após betta) → herda `betta` + salva `volume=60`.
7. `minha água está boa para betta?` (com leitura DB) → contém `Diagnóstico`.
8. `TDS 800 alto para neon?` → diagnostica `tds` mesmo sem `especie` no payload.
9. `qual receita de bolo?` → `só respondo sobre aquarismo` (sem falso-positivo `peixe`).
10. `compatível?` sem espécies → follow-up `Qual a segunda espécie?`.

## 8. Testes

- `backend/tests/test_chat.py` estendido com os 10 casos (asserts: `especie`,
  `state`, substring de fonte, presença de `followup`).
- `backend/tests/test_dialogue_state.py`: normalização, fuzzy, merge, regex,
  limites de faixa.
- Fase D expande para ~50 casos + métricas (slots, citação, alucinação zero).

## 9. Aceite

- `e ele? / e em 60L? / bettas` funcionam; nenhuma resposta perde espécie.
- Latência regras <200ms; sem chave/rede tudo funciona (offline-first).
- `pytest backend/tests/test_chat.py backend/tests/test_dialogue_state.py` verdes.
