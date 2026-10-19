# IA Fase B — RAG lexical estrito + citações + ML no contexto

> Sem vetores/embeddings. Offline-first preservado (stdlib + `aquarismo.json`).

## 1. Índice (`backend/app/services/chat_retrieval.py`)

- `chunks_for(fish)`: 10 chunks por espécie — `pH, temp, TDS, GH, volume mín,
  dieta, comportamento, dificuldade, compatibilidade, ficha` — cada um com
  `{especie, nome, campo, valor, fonte, texto}`; `fonte` = `fontes[0]` da ficha
  (ex.: `Seriously Fish — Betta splendens`) ou `AquaSense aquarismo.json`.
- `retrieve(especie, intent, segunda, top_k=3)`: campos do intent primeiro
  (`INTENT_FIELDS`); compat inclui ficha da 2ª espécie; completa com `ficha`.
  Espécie desconhecida/`None` → `[]` (estrito).
- `cite(ev)` → `"Fonte — Nome: campo valor"`, ex.:
  `"Seriously Fish — Betta splendens: pH 6.5-7.5"`.

## 2. Respostas citadas (`backend/app/api/chat.py`)

- `_regras_reply` monta `evidence` e cita via `_cite(campo)` com fallback para
  `ficha` — nenhum número sem evidência correspondente.
- Ramos cobertos: ficha, pH, GH, TDS, temp, volume, compat (2 espécies),
  dieta, dificuldade. Diagnóstico sensorial cita `diagnose()["sources"]`.
- Estrito: espécie fora da base → `não está na base + orientação geral`
  (sem inventar faixas) + follow-up com espécies da base.
- `ChatResponse.evidence: list[EvidenceChunk]` (compat: default `[]`).

## 3. Modelo de qualidade da água no contexto

- `chat()` captura a última `Reading` (`prediction/probability/anomaly`).
- LLM: linha adicionada ao `context_msg`
  (`Modelo ... (estimativa, não certifica potabilidade)`).
- Regras: quando há `Diagnóstico da água atual`, anexa
  `Modelo: {pred} ({prob}%) — estimativa estatística, não certifica potabilidade.`
  + fonte `Modelo qualidade da água (RandomForest + Isolation Forest)`.

## 4. Frontend (`AquarismoChat.tsx`)

- Chips de evidência (`📖 nome · campo valor`) acima do follow-up;
  clique fixa a espécie e pergunta `ficha para {especie}?`.
- Tipos: `EvidenceChunk` + `ChatResponse.evidence/state/followup`.

## 5. Testes

- `backend/tests/test_chat_retrieval.py`: citação betta, vazio estrito,
  compat com 2ª espécie, cap `top_k`.
- `test_chat.py` estendido: toda resposta com espécie traz `evidence`
  e ao menos uma fonte com `—` (citação verificável).
- Golden (`chat_golden.jsonl`): casos de citação pH/TDS/compat.

## 6. Aceite

- `retrieve("betta","ph")[0]` = pH `6.5-7.5` com fonte Seriously Fish.
- `pytest tests/test_chat_retrieval.py tests/test_chat.py` verdes.
- Nenhuma faixa numérica fora de `aquarismo.json` nas respostas de espécie.
