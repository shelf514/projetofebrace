import logging
import re
import time as _time
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database.db import get_db
from app.schemas.chat import ChatHistoryResponse, ChatRequest, ChatResponse
from app.services import aquarismo_service

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger("aquasense.chat")

SYSTEM_PROMPT = """Você é o assistente de aquarismo do AquaSense AI.
Responda APENAS sobre aquarismo (peixes, pH, temperatura, TDS, turbidez, GH, filtragem, trocas parciais, alimentação, compatibilidade, volume).
Se a pergunta for fora do escopo, diga que só responde sobre aquarismo e redirecione.
Seja conciso (máx 6 linhas), cite pH/temp/TDS/GH/volume da base quando citar espécie, e lembre que é estimativa — não substitui veterinário/laboratório.
Nunca invente pH fora da base fornecida; se espécie desconhecida, diga que não está na base e dê orientação geral.
FORMATAÇÃO OBRIGATÓRIA: texto puro sem markdown. NUNCA use **, *, #, -, ` ou listas com asteriscos. Use frases curtas e quebras de linha simples. Ex.: "pH ideal para betta: 6.5-7.5.".
Idioma: português (pt-BR)."""

# --- Conversa em memória (TTL 30min, cap anti-DoS) ---
_CONVERSATIONS: dict[str, dict] = {}
_CONV_TTL_SEC = 30 * 60
_CONV_MAX_MSGS = 20
_CONV_MAX_CONVS = 500

OUT_OF_SCOPE_WORDS = [
    "receita", "futebol", "política", "politica", "programação", "programacao",
    "filme", "série", "serie", "música", "musica", "jogo", "game", "criptomoeda",
    "bitcoin", "eleição", "eleicao", "notícia", "noticia", "clima tempo",
    "remédio", "medicamento", "receita médica",
]


def _conv_cleanup() -> None:
    now = _time.monotonic()
    expired = [k for k, v in _CONVERSATIONS.items() if now - v["updated_at"] > _CONV_TTL_SEC]
    for k in expired:
        _CONVERSATIONS.pop(k, None)


def _conv_add(conv_id: str, role: str, content: str) -> None:
    _conv_cleanup()
    # Cap de conversas simultaneas: evita DoS de memoria via N conversation_ids
    if conv_id not in _CONVERSATIONS and len(_CONVERSATIONS) >= _CONV_MAX_CONVS:
        oldest = min(_CONVERSATIONS, key=lambda k: _CONVERSATIONS[k]["updated_at"])
        _CONVERSATIONS.pop(oldest, None)
    entry = _CONVERSATIONS.setdefault(conv_id, {"messages": [], "updated_at": _time.monotonic()})
    entry["messages"].append({"role": role, "content": content, "ts": _time.time()})
    # limita tamanho
    if len(entry["messages"]) > _CONV_MAX_MSGS:
        entry["messages"] = entry["messages"][-_CONV_MAX_MSGS:]
    entry["updated_at"] = _time.monotonic()


def _detect_especie(msg_lower: str, especie_field: str | None) -> str | None:
    if especie_field and especie_field.strip():
        return especie_field.strip().lower()
    for esp in aquarismo_service.list_especies():
        if re.search(rf"\b{re.escape(esp)}\b", msg_lower):
            return esp
    return None


def _regras_reply(payload: ChatRequest, temp, turb, tds, ph, gh, volume_l) -> ChatResponse:
    msg_lower = payload.message.lower()
    especie = _detect_especie(msg_lower, payload.especie)

    # --- fora de escopo: detecção ampliada ---
    is_aquarismo = any(
        kw in msg_lower
        for kw in [
            "ph", "gh", "tds", "turbidez", "turbidity", "temperatura", "temp ",
            "aquário", "aquario", "peixe", "betta", "neon", "guppy", "volum", "litro",
            "compat", "aliment", "ração", "racao", "dieta", "troca", "filtragem", "filtro",
            "espécie", "especie", "kingui", "cascudo", "coridora", "acaradisco", "oscar",
        ]
    ) or especie is not None
    if not is_aquarismo and any(w in msg_lower for w in OUT_OF_SCOPE_WORDS):
        return ChatResponse(
            reply="Só respondo sobre aquarismo (pH, temperatura, TDS, turbidez, GH, volume, compatibilidade, alimentação, trocas parciais). Me diga a espécie e a dúvida — ex.: 'pH ideal para betta?' ou 'posso colocar betta com neon em 60L?'",
            sources=["AquaSense aquarismo.json"],
            model_used="regras",
            especie=None,
            conversation_id=payload.conversation_id,
        )

    sources: list[str] = []
    reply_parts: list[str] = []

    fish = aquarismo_service.get_fish(especie) if especie else None

    # Ficha básica: só quando pergunta é genérica (sem intent específico) e espécie citada
    has_specific_intent = any(kw in msg_lower for kw in ["ph", "gh", "dureza", "tds", "sólidos", "temperatura", "temp ", "quente", "frio", "turbidez", "turbidity", "volume", "litro", "compat", "posso colocar", "junto com", "misturar", "aliment", "ração", "racao", "dieta", "troca", "filtragem", "filtro", "sifon", "dificuldade", "iniciante", "avançado"])
    if especie and not has_specific_intent:
        if fish:
            reply_parts.append(
                f"{fish['nome']} — pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}, vol. mín {fish.get('volume_min_l','?')}L. {fish['notas']}"
            )
            sources.append(f"{fish['nome']}: pH {fish['ph_min']}-{fish['ph_max']}")
            if fish.get("fontes"):
                sources.extend(fish["fontes"][:1])
        else:
            reply_parts.append(f"Espécie '{especie}' não está na base ({', '.join(aquarismo_service.list_especies()[:8])}...).")
            sources.append("Base aquarismo.json")

    # Intents específicos (cada um só se palavra-chave presente)
    if "ph" in msg_lower:
        if fish:
            reply_parts.append(f"pH ideal para {especie}: {fish['ph_min']}-{fish['ph_max']}. Mantenha estável; trocas bruscas matam mais que pH levemente fora.")
        else:
            reply_parts.append("pH ideal varia: amazônicos (neon, discus) 6.0-7.0 | betta/colisa 6.5-7.5 | vivíparos (guppy/plati) 7.0-8.2. Informe a espécie para valor exato.")

    if any(k in msg_lower for k in ["gh", "dureza"]):
        if fish:
            reply_parts.append(f"GH ideal para {especie}: {fish['gh_min']}-{fish['gh_max']}. GH baixo = água mole (amazônicos); alto = dura (vivíparos).")
        else:
            reply_parts.append("GH ideal varia: amazônicos 1-6 | betta/coridora 3-10 | vivíparos 8-15. Informe a espécie.")

    if any(k in msg_lower for k in ["tds", "sólidos"]):
        if fish and tds is not None:
            diag = aquarismo_service.diagnose(None, None, tds, especie)
            reply_parts.append(f"TDS atual {tds:.0f} ppm: " + " ".join(diag["alertas"][:1]))
            sources.extend(diag["sources"][:1])
        elif fish:
            reply_parts.append(f"TDS ideal para {especie}: até {fish['tds_max']} ppm (mín {fish['tds_min']} ppm). Acima disso: trocas 25%.")
        else:
            reply_parts.append("TDS até 300 ppm (amazônicos/betta), até 600 ppm (vivíparos). Acima de 1000 ppm é muito dura (Portaria 888).")

    if any(k in msg_lower for k in ["temperatura", "temp ", "quente", "frio"]):
        if fish:
            reply_parts.append(f"Temperatura ideal para {especie}: {fish['temp_min']}-{fish['temp_max']}°C.")
        elif temp is not None and especie:
            diag = aquarismo_service.diagnose(temp, None, None, especie)
            reply_parts.append(" ".join(diag["alertas"][:1]))

    if "turbidez" in msg_lower or "turbidity" in msg_lower:
        if turb is not None:
            diag = aquarismo_service.diagnose(None, turb, None, especie)
            reply_parts.append(" ".join(diag["alertas"][:1]))
            sources.extend(diag["sources"][:1])
        else:
            reply_parts.append("Turbidez ideal para aquário: até 15 NTU (5 NTU potável). Acima: limpe filtro, reduza alimentação, sifone fundo.")

    if any(k in msg_lower for k in ["volume", "litro", "litros", "tamanho aquário"]):
        if fish:
            vol = fish.get("volume_min_l", "?")
            tamanho = fish.get("tamanho_adulto_cm", "?")
            reply_parts.append(f"Volume mínimo para {especie} ({fish['nome']}): {vol}L (adulto {tamanho} cm, vive {fish.get('esperanca_anos','?')} anos).")
        else:
            reply_parts.append("Volume mínimo: betta 20L | neon/tetra/coridora 60L | kingui 120L | discus 200L | oscar 250L.")

    # Compatibilidade: detecta segunda espécie na mensagem (sem "com " genérico)
    if any(k in msg_lower for k in ["compat", "posso colocar", "junto com", "misturar", "convive"]):
        # tenta achar duas espécies
        especies_na_msg = [esp for esp in aquarismo_service.list_especies() if re.search(rf"\b{re.escape(esp)}\b", msg_lower)]
        companheiros_payload = [c.strip().lower() for c in (payload.companheiros or []) if c.strip()]
        # prioriza payload companheiros, senão msg
        if len(especies_na_msg) >= 2 and especie:
            # especie é a primeira, segunda é compat
            outra = next((e for e in especies_na_msg if e != especie), None)
            if outra:
                comp = aquarismo_service.check_compatibilidade(especie, outra)
                reply_parts.append(f"Compatibilidade {especie} + {outra}: {'compatível' if comp['compativel'] else 'incompatível' if comp['compativel'] is False else 'incerta'} — {comp['motivo']}")
                sources.append(f"Compatibilidade: {especie}/{outra}")
        elif companheiros_payload and especie:
            for comp_especie in companheiros_payload[:3]:
                comp = aquarismo_service.check_compatibilidade(especie, comp_especie)
                reply_parts.append(f"Compatibilidade {especie} + {comp_especie}: {'compatível' if comp['compativel'] else 'incompatível' if comp['compativel'] is False else 'incerta'} — {comp['motivo']}")
        elif especie and fish and fish.get("compativeis"):
            reply_parts.append(f"Compatíveis com {especie}: {', '.join(fish['compativeis'][:5])}. Incompatíveis: {', '.join(fish.get('incompativeis',[])[:5])}. Use /api/aquarismo/recomendar para checagem completa.")
        elif not especie:
            reply_parts.append("Para checar compatibilidade, informe duas espécies — ex.: 'posso colocar betta com coridora em 60L?'")

    if any(k in msg_lower for k in ["aliment", "ração", "racao", "comida", "dieta"]):
        if fish and fish.get("dieta"):
            reply_parts.append(f"Dieta {especie} ({fish['nome']}): {fish['dieta']}. Alimente 1-2x/dia, só o que consomem em 2 min.")
        elif fish:
            reply_parts.append(f"Alimentação {especie}: ração específica + suplemento vivo/congelado 2x/semana. Evite excesso.")
        else:
            reply_parts.append("Alimentação geral: ração flakes/pellets + vivo (artêmia/dáfnia) 2x/semana. Não superalimente — principal causa de turbidez/amônia.")

    if any(k in msg_lower for k in ["troca", "trocas", "filtragem", "filtro", "sifon"]):
        reply_parts.append("Rotina: trocas parciais 25% semanais com água declorada, sifonagem do fundo, limpeza do filtro só com água do aquário (nunca torneira).")

    if any(k in msg_lower for k in ["dificuldade", "iniciante", "avançado", "avancado", "fácil", "facil"]):
        if fish:
            reply_parts.append(f"Dificuldade {especie}: {fish.get('dificuldade','—')} — {fish.get('comportamento','')}")

    # Diagnóstico sensor: só se pergunta menciona água/parâmetros (evita poluir compat/volume/dieta)
    should_diag = payload.include_sensor_context and any(v is not None for v in (temp, turb, tds, ph, gh))
    should_diag = should_diag and any(kw in msg_lower for kw in ["água", "agua", "está boa", "esta boa", "diagnóstico", "diagnostico", "sensor", "tds", "ph", "gh", "temperatura", "temp ", "turbidez", "como está", "está bom"])
    if should_diag:
        diag = aquarismo_service.diagnose(temp, turb, tds, especie or None, ph=ph, gh=gh)
        reply_parts.append("Diagnóstico da água atual: " + " | ".join(diag["alertas"]))
        sources.extend(diag["sources"])

    # Fallback
    if len(reply_parts) == 0:
        reply_parts.append(
            "Posso ajudar com pH, temperatura, TDS, turbidez, GH, volume, compatibilidade e alimentação por espécie. Ex.: 'pH ideal para betta?', 'TDS 800 alto para neon?', 'posso colocar betta com neon em 60L?'. Informe a espécie e, se quiser, marque 'usar leitura atual'."
        )
        sources.append("AquaSense aquarismo.json + Portaria 888/2021")

    # Separa com linha visual única, sem markdown
    reply = "\n\n".join(p.strip() for p in reply_parts if p.strip())

    # Sanitiza markdown residual do LLM ou regras antigas
    reply = re.sub(r"\*\*(.*?)\*\*", r"\1", reply)
    reply = re.sub(r"^\s*#{1,6}\s*", "", reply, flags=re.MULTILINE)
    reply = re.sub(r"^\s*[\*\-]\s+", "• ", reply, flags=re.MULTILINE)
    reply = reply.replace("`", "")

    if len(reply) > 1200:
        reply = reply[:1197] + "..."
    return ChatResponse(
        reply=reply,
        sources=list(dict.fromkeys(sources)),
        model_used="regras",
        especie=especie or None,
        conversation_id=payload.conversation_id,
    )


async def _openai_reply(payload: ChatRequest, temp, turb, tds, ph, context_msg: str) -> ChatResponse | None:
    if not settings.llm_api_key:
        return None
    # inclui histórico se houver conversation_id
    history_msgs = []
    if payload.conversation_id and payload.conversation_id in _CONVERSATIONS:
        for m in _CONVERSATIONS[payload.conversation_id]["messages"][-6:]:
            role = "user" if m["role"] == "user" else "assistant"
            history_msgs.append({"role": role, "content": m["content"]})
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "system", "content": context_msg},
            ] + history_msgs + [{"role": "user", "content": payload.message}]
            resp = await client.post(
                f"{settings.llm_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"},
                json={
                    "model": settings.llm_model,
                    "messages": messages,
                    "temperature": 0.4,
                    "max_tokens": 450,
                },
            )
            if resp.status_code != 200:
                logger.warning("LLM %s falhou: %s %s", settings.llm_model, resp.status_code, resp.text[:300])
                return None
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            # Sanitiza markdown do LLM para texto puro
            text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
            text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
            text = re.sub(r"^\s*[\*\-]\s+", "• ", text, flags=re.MULTILINE)
            text = text.replace("`", "")
            return ChatResponse(reply=text, sources=["OpenAI " + settings.llm_model, "aquarismo.json"], model_used="openai", especie=payload.especie, conversation_id=payload.conversation_id)
    except Exception as exc:
        logger.warning("LLM erro: %s", exc)
        return None


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request, db: Session = Depends(get_db)):
    # conversation_id: gera se não veio
    if not payload.conversation_id:
        payload.conversation_id = str(uuid.uuid4())[:8]

    temp = payload.temperature
    turb = payload.turbidity
    tds = payload.tds
    ph = payload.ph
    gh = payload.gh

    if payload.include_sensor_context and all(v is None for v in (temp, tds, turb, ph, gh)):
        try:
            from app.models import Reading

            last = db.query(Reading).order_by(Reading.timestamp.desc()).first()
            if last:
                temp, turb, tds = last.temperature, last.turbidity, last.tds
        except Exception:
            pass

    context_msg = aquarismo_service.build_context_message(payload.especie, temp, turb, tds, ph=ph)

    # guarda pergunta do usuário
    _conv_add(payload.conversation_id, "user", payload.message)

    # Tenta OpenAI se configurado
    if settings.llm_api_key:
        oai = await _openai_reply(payload, temp, turb, tds, ph, context_msg)
        if oai:
            diag = aquarismo_service.diagnose(temp, turb, tds, payload.especie, ph=ph, gh=gh)
            oai.sources = list(dict.fromkeys(oai.sources + diag["sources"]))
            _conv_add(oai.conversation_id or payload.conversation_id, "assistant", oai.reply)
            return oai

    # Fallback regras
    resp = _regras_reply(payload, temp, turb, tds, ph, gh, payload.volume_l)
    _conv_add(payload.conversation_id, "assistant", resp.reply)
    return resp


@router.get("/especies")
def list_especies():
    data = aquarismo_service._load()
    resumo = [
        {"especie": f["especie"], "nome": f["nome"], "ph_min": f["ph_min"], "ph_max": f["ph_max"]}
        for f in data
    ]
    return {"especies": resumo, "total": len(resumo)}


@router.get("/history/{conversation_id}", response_model=ChatHistoryResponse)
def get_history(conversation_id: str):
    _conv_cleanup()
    entry = _CONVERSATIONS.get(conversation_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Conversa não encontrada ou expirada (TTL 30min).")
    return {"conversation_id": conversation_id, "messages": entry["messages"], "count": len(entry["messages"])}


@router.delete("/history/{conversation_id}")
def delete_history(conversation_id: str):
    if conversation_id in _CONVERSATIONS:
        _CONVERSATIONS.pop(conversation_id)
        return {"deleted": True, "conversation_id": conversation_id}
    raise HTTPException(status_code=404, detail="Conversa não encontrada.")
