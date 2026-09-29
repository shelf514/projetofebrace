import json
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
from app.services import aquarismo_service, chat_retrieval, dialogue_state

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger("aquasense.chat")

SYSTEM_PROMPT = """Você é o assistente de aquarismo do AquaSense AI.
Responda APENAS sobre aquarismo (peixes, pH, temperatura, TDS, turbidez, GH, filtragem, trocas parciais, alimentação, compatibilidade, volume, ciclagem, doenças).
Se a pergunta for fora do escopo, diga que só responde sobre aquarismo e redirecione.
Seja conciso (máx 6 linhas), cite pH/temp/TDS/GH/volume da base quando citar espécie, e lembre que é estimativa — não substitui veterinário/laboratório.
Nunca invente pH fora da base fornecida; se espécie desconhecida, diga que não está na base e dê orientação geral.
FORMATAÇÃO OBRIGATÓRIA: texto puro sem markdown. NUNCA use **, *, #, -, ` ou listas com asteriscos. Use frases curtas e quebras de linha simples. Ex.: "pH ideal para betta: 6.5-7.5.".
Idioma: português (pt-BR)."""

_CONVERSATIONS: dict[str, dict] = {}
_CONV_TTL_SEC = 30 * 60
_CONV_MAX_MSGS = 20
_CONV_MAX_CONVS = 500


def _conv_cleanup() -> None:
    now = _time.monotonic()
    expired = [k for k, v in _CONVERSATIONS.items() if now - v["updated_at"] > _CONV_TTL_SEC]
    for k in expired:
        _CONVERSATIONS.pop(k, None)


def _conv_add(conv_id: str, role: str, content: str) -> None:
    _conv_cleanup()
    if conv_id not in _CONVERSATIONS and len(_CONVERSATIONS) >= _CONV_MAX_CONVS:
        oldest = min(_CONVERSATIONS, key=lambda k: _CONVERSATIONS[k]["updated_at"])
        _CONVERSATIONS.pop(oldest, None)
    entry = _CONVERSATIONS.setdefault(conv_id, {"messages": [], "updated_at": _time.monotonic()})
    entry["messages"].append({"role": role, "content": content, "ts": _time.time()})
    if len(entry["messages"]) > _CONV_MAX_MSGS:
        entry["messages"] = entry["messages"][-_CONV_MAX_MSGS:]
    entry["updated_at"] = _time.monotonic()


def _detect_especie(msg_lower: str, especie_field: str | None) -> str | None:
    if especie_field and especie_field.strip():
        canon = dialogue_state.canonical_especie(especie_field)
        if canon:
            return canon
    found = dialogue_state.extract_all_especies(msg_lower, aquarismo_service.list_especies())
    return found[0] if found else None


def _get_state(conv_id: str | None) -> dict:
    if conv_id and conv_id in _CONVERSATIONS:
        st = _CONVERSATIONS[conv_id].get("state")
        if isinstance(st, dict) and st:
            return st
    return dialogue_state.new_state()


def _save_state(conv_id: str, state: dict) -> None:
    entry = _CONVERSATIONS.setdefault(conv_id, {"messages": [], "updated_at": _time.monotonic()})
    entry["state"] = state
    entry["updated_at"] = _time.monotonic()


def _regras_reply(payload: ChatRequest, temp, turb, tds, ph, gh, volume_l, state: dict | None = None) -> ChatResponse:
    msg_lower = payload.message.lower()
    msg_norm = dialogue_state.normalize_text(payload.message)
    known = aquarismo_service.list_especies()
    turn = dialogue_state.extract_turn(payload.message, known)
    if payload.especie and payload.especie.strip():
        canon = dialogue_state.canonical_especie(payload.especie)
        resolved = canon or payload.especie.strip().lower()
        turn["especie"] = resolved
        turn["especies"] = [resolved] + [e for e in turn["especies"] if e != resolved]
    if payload.companheiros:
        for c in payload.companheiros[:3]:
            cc = dialogue_state.canonical_especie(c)
            if cc and cc != turn.get("especie") and cc not in turn["companheiros"]:
                turn["companheiros"].append(cc)
    for k in ("volume_l", "ph", "gh"):
        v = getattr(payload, k, None)
        if v is not None:
            turn["params"][k] = v
    state = dialogue_state.merge_state(state or dialogue_state.new_state(), turn)
    if not turn.get("intents") and len(turn.get("especies", [])) >= 2:
        turn["intents"] = ["compat"]
        turn["intent"] = "compat"
        state["last_intent"] = "compat"
    especie = state.get("especie") or turn.get("especie")
    segunda = turn.get("segunda_especie") or state.get("segunda_especie")
    intents = turn.get("intents") or []
    primary_intent = intents[0] if intents else state.get("last_intent")
    if volume_l is not None and state.get("volume_l") is None:
        state["volume_l"] = volume_l
    volume_eff = state.get("volume_l") if state.get("volume_l") is not None else volume_l

    # --- Guardrail: fora de escopo ---
    if not dialogue_state.is_aquarismo(msg_norm) and not especie:
        if dialogue_state.is_out_of_scope(msg_norm) or not intents:
            return ChatResponse(
                reply="Só respondo sobre aquarismo (pH, temperatura, TDS, turbidez, GH, volume, compatibilidade, alimentação, trocas parciais, ciclagem, doenças). Me diga a espécie e a dúvida — ex.: 'pH ideal para betta?' ou 'posso colocar betta com coridora em 60L?'",
                sources=["AquaSense aquarismo.json"],
                model_used="regras",
                especie=None,
                conversation_id=payload.conversation_id,
                state=state,
                followup="Qual a espécie? Ex.: 'pH ideal para betta?'",
                evidence=[],
            )

    sources: list[str] = []
    reply_parts: list[str] = []
    evidence: list[dict] = []

    fish = aquarismo_service.get_fish(especie) if especie else None
    if fish:
        evidence = chat_retrieval.retrieve(especie, primary_intent, segunda=segunda, top_k=3)

    def _cite(campo: str) -> None:
        for ev in evidence:
            if ev["campo"] == campo and chat_retrieval.cite(ev) not in sources:
                sources.append(chat_retrieval.cite(ev))
                return
        for ev in evidence:
            if ev["campo"] == "ficha" and chat_retrieval.cite(ev) not in sources:
                sources.append(chat_retrieval.cite(ev))
                return

    # --- Ficha básica: só quando o TURNO é genérico ---
    has_specific_intent = bool(intents)
    if especie and not has_specific_intent:
        if fish:
            reply_parts.append(
                f"{fish['nome']} — pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}, vol. mín {fish.get('volume_min_l','?')}L. {fish['notas']}"
            )
            _cite("ficha")
        else:
            reply_parts.append(f"Espécie '{especie}' não está na base ({', '.join(known[:8])}...). Posso orientar com faixas gerais ou a ficha de uma espécie da base — qual delas?")
            sources.append(f"Base aquarismo.json ({len(known)} espécies)")

    if especie and not fish and has_specific_intent:
        reply_parts.append(f"Espécie '{especie}' não está na base ({', '.join(known[:8])}...). Posso orientar com faixas gerais ou a ficha de uma espécie da base — qual delas?")
        sources.append(f"Base aquarismo.json ({len(known)} espécies)")

    # --- Intents específicos (multi-intent) ---
    has_params = any(v is not None for v in (temp, turb, tds, ph, gh))
    for intent in intents:
        if intent == "ph":
            if fish:
                reply_parts.append(f"pH ideal para {especie}: {fish['ph_min']}-{fish['ph_max']}. Mantenha estável; trocas bruscas matam mais que pH levemente fora.")
                _cite("pH")
            else:
                reply_parts.append("pH ideal varia: amazônicos (neon, discus) 6.0-7.0 | betta/colisa 6.5-7.5 | vivíparos (guppy/plati) 7.0-8.2. Informe a espécie para valor exato com fonte.")

        elif intent == "gh":
            if fish:
                reply_parts.append(f"GH ideal para {especie}: {fish['gh_min']}-{fish['gh_max']}. GH baixo = água mole/macia (amazônicos); alto = dura (vivíparos).")
                _cite("GH")
            else:
                reply_parts.append("GH ideal varia: amazônicos 1-6 | betta/coridora 3-10 | vivíparos 8-15. Informe a espécie.")

        elif intent == "tds":
            if fish and tds is not None:
                diag = aquarismo_service.diagnose(None, None, tds, especie)
                reply_parts.append(f"TDS atual {tds:.0f} ppm: " + " ".join(diag["alertas"][:1]))
                sources.extend(diag["sources"][:1])
                _cite("TDS")
            elif fish:
                reply_parts.append(f"TDS ideal para {especie}: até {fish['tds_max']} ppm (mín {fish['tds_min']} ppm). Acima disso: trocas 25%.")
                _cite("TDS")
            else:
                reply_parts.append("TDS até 300 ppm (amazônicos/betta), até 600 ppm (vivíparos). Acima de 1000 ppm é muito dura (Portaria 888).")

        elif intent == "temp":
            if fish:
                reply_parts.append(f"Temperatura ideal para {especie}: {fish['temp_min']}-{fish['temp_max']}°C.")
                _cite("temp")
            if temp is not None and especie:
                diag = aquarismo_service.diagnose(temp, None, None, especie)
                if diag["alertas"]:
                    reply_parts.append(" ".join(diag["alertas"][:1]))

        elif intent == "turbidez":
            if turb is not None:
                diag = aquarismo_service.diagnose(None, turb, None, especie)
                reply_parts.append(" ".join(diag["alertas"][:1]))
                sources.extend(diag["sources"][:1])
            else:
                reply_parts.append("Turbidez ideal para aquário: até 15 NTU (5 NTU potável). Acima: limpe filtro, reduza alimentação, sifone fundo.")

        elif intent == "volume":
            if fish:
                vol = fish.get("volume_min_l", "?")
                tamanho = fish.get("tamanho_adulto_cm", "?")
                reply_parts.append(f"Volume mínimo para {especie} ({fish['nome']}): {vol}L (adulto {tamanho} cm, vive {fish.get('esperanca_anos','?')} anos).")
                _cite("volume mín")
            else:
                reply_parts.append("Volume mínimo: betta 20L | neon/tetra/coridora 60L | kingui 120L | discus 200L | oscar 250L.")

        elif intent == "compat":
            especies_na_msg = turn.get("especies", []) or []
            companheiros_payload = [c.strip().lower() for c in (payload.companheiros or []) if c.strip()]
            outra = segunda
            if not outra and companheiros_payload and companheiros_payload[0] != especie:
                outra = dialogue_state.canonical_especie(companheiros_payload[0])
            if not outra and state.get("companheiros"):
                outra = next((c for c in state["companheiros"] if c != especie), None)
            if especie and outra:
                comp = aquarismo_service.check_compatibilidade(especie, outra)
                reply_parts.append(f"Compatibilidade {especie} + {outra}: {'compatível' if comp['compativel'] else 'incompatível' if comp['compativel'] is False else 'incerta'} — {comp['motivo']}")
                _cite("compatibilidade")
                if volume_eff is not None:
                    reply_parts.append(f"Volume informado: {volume_eff:g}L.")
            elif companheiros_payload and especie:
                for comp_especie in companheiros_payload[:3]:
                    comp = aquarismo_service.check_compatibilidade(especie, comp_especie)
                    reply_parts.append(f"Compatibilidade {especie} + {comp_especie}: {'compatível' if comp['compativel'] else 'incompatível' if comp['compativel'] is False else 'incerta'} — {comp['motivo']}")
                _cite("compatibilidade")
            elif especie and fish and fish.get("compativeis"):
                reply_parts.append(f"Compatíveis com {especie}: {', '.join(fish['compativeis'][:5])}. Incompatíveis: {', '.join(fish.get('incompativeis',[])[:5])}. Use /api/aquarismo/recomendar para checagem completa.")
            elif not especie:
                reply_parts.append("Para checar compatibilidade, informe duas espécies — ex.: 'posso colocar betta com coridora em 60L?'")

        elif intent == "dieta":
            if fish and fish.get("dieta"):
                reply_parts.append(f"Dieta {especie} ({fish['nome']}): {fish['dieta']}. Alimente 1-2x/dia, só o que consomem em 2 min.")
                _cite("dieta")
            elif fish:
                reply_parts.append(f"Alimentação {especie}: ração específica + suplemento vivo/congelado 2x/semana. Evite excesso.")
                _cite("dieta")
            else:
                base = "Alimentação geral: ração flakes/pellets + vivo (artêmia/dáfnia) 2x/semana. Frequência: 1-2x/dia, só o que consomem em 2 min. Não superalimente — principal causa de turbidez/amônia."
                if "jejum" in msg_norm:
                    base += " Jejum de 1x/semana ajuda na digestão e na qualidade da água."
                reply_parts.append(base)

        elif intent == "manutencao":
            reply_parts.append("Rotina: trocas parciais 25% semanais com água declorada (use condicionador — a torneira tem cloro que mata as bactérias benéficas), sifonagem do fundo, limpeza do filtro só com água do aquário (nunca torneira).")

        elif intent == "dificuldade":
            if fish:
                reply_parts.append(f"Dificuldade {especie}: {fish.get('dificuldade','—')} — {fish.get('comportamento','')}")
                _cite("dificuldade")
                if "espelho" in msg_norm and especie == "betta":
                    reply_parts.append("Espelho: use no máximo 5 min/dia como exercício — mais que isso causa estresse crônico no betta.")

        elif intent == "ciclagem":
            guia = chat_retrieval.get_guia("ciclagem")
            if guia:
                reply_parts.append(guia["conteudo"])
                sources.append(guia["fonte"])

        elif intent == "newtank":
            guia = chat_retrieval.get_guia("newtank")
            if guia:
                reply_parts.append(guia["conteudo"])
                sources.append(guia["fonte"])

        elif intent == "diagnostico":
            if not has_params:
                if fish:
                    reply_parts.append(
                        f"Para diagnosticar a água para {especie} ({fish['nome']}): pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}. Me diga os valores medidos (ex.: 'pH 7.0, temp 26, TDS 300 para betta?') ou marque 'usar leitura atual'."
                    )
                    _cite("ficha")
                else:
                    guia = chat_retrieval.get_guia("diagnostico")
                    if guia:
                        reply_parts.append(guia["conteudo"])
                        sources.append(guia["fonte"])

        elif intent == "doenca":
            guia = chat_retrieval.get_guia("doencas")
            if guia:
                reply_parts.append(guia["conteudo"])
                sources.append(guia["fonte"])

        elif intent == "equipamento":
            if "planta" in msg_norm or "substrato" in msg_norm:
                reply_parts.append("Aquário plantado: use substrato fértil (ou inerte + pastilhas de raiz), iluminação 6-8h/dia, CO2 ajuda mas não é obrigatório. Plantas consomem nitrato e reduzem algas. Comece com espécies fáceis: anúbias, musgo de java, elódea.")
                sources.append("AquaSense guias: aquário plantado")
            elif "ilumin" in msg_norm or "led" in msg_norm or "luz" in msg_norm:
                reply_parts.append("Iluminação: LED branco 6500K, 6-8h/dia com timer. Excesso de luz causa algas; pouca luz prejudica plantas. Para só peixes, luz moderada basta.")
                sources.append("AquaSense guias: iluminação")
            else:
                guia = chat_retrieval.get_guia("filtragem")
                if guia:
                    reply_parts.append(guia["conteudo"])
                    sources.append(guia["fonte"])

    # --- Diagnóstico sensor ---
    should_diag = payload.include_sensor_context and has_params
    if should_diag:
        diag = aquarismo_service.diagnose(temp, turb, tds, especie or None, ph=ph, gh=gh)
        if diag["alertas"]:
            reply_parts.append("Diagnóstico da água atual: " + " | ".join(diag["alertas"]))
        sources.extend(diag["sources"])

    # --- Follow-up ---
    followup = dialogue_state.followup_for(state, intents)

    # --- Fallback ---
    if len(reply_parts) == 0:
        reply_parts.append(
            "Posso ajudar com pH, temperatura, TDS, turbidez, GH, volume, compatibilidade, alimentação, trocas parciais, ciclagem e doenças por espécie. Ex.: 'pH ideal para betta?', 'TDS 800 alto para neon?', 'posso colocar betta com neon em 60L?'. Informe a espécie e, se quiser, marque 'usar leitura atual'."
        )
        sources.append("AquaSense aquarismo.json + Portaria 888/2021")
        if followup is None:
            followup = "Qual a espécie? Ex.: 'pH ideal para betta?'"
    elif followup and len(reply_parts) >= 2:
        followup = None

    reply = "\n\n".join(p.strip() for p in reply_parts if p.strip())
    reply = re.sub(r"\*\*(.*?)\*\*", r"\1", reply)
    reply = re.sub(r"^\s*#{1,6}\s*", "", reply, flags=re.MULTILINE)
    reply = re.sub(r"^\s*[\*\-]\s+", "• ", reply, flags=re.MULTILINE)
    reply = reply.replace("`", "")

    if len(reply) > 1200:
        reply = reply[:1197] + "..."
    if followup:
        reply = f"{reply}\n\n{followup}"
    return ChatResponse(
        reply=reply,
        sources=list(dict.fromkeys(sources)),
        model_used="regras",
        especie=especie or None,
        conversation_id=payload.conversation_id,
        state=state,
        followup=followup,
        evidence=evidence,
    )


async def _openai_reply(payload: ChatRequest, temp, turb, tds, ph, context_msg: str, evidence: list[dict], especie: str | None = None) -> ChatResponse | None:
    if not settings.llm_api_key:
        return None
    history_msgs = []
    if payload.conversation_id and payload.conversation_id in _CONVERSATIONS:
        for m in _CONVERSATIONS[payload.conversation_id]["messages"][-6:]:
            role = "user" if m["role"] == "user" else "assistant"
            history_msgs.append({"role": role, "content": m["content"]})
    evidence_json = json.dumps(evidence, ensure_ascii=False) if evidence else "[]"
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "system", "content": context_msg},
                {"role": "system", "content": f"EVIDÊNCIAS DA BASE (use apenas estes números): {evidence_json}"},
            ] + history_msgs + [{"role": "user", "content": payload.message}]
            resp = await client.post(
                f"{settings.llm_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"},
                json={
                    "model": settings.llm_model,
                    "messages": messages,
                    "temperature": 0.0,
                    "max_tokens": 450,
                },
            )
            if resp.status_code != 200:
                logger.warning("LLM %s falhou: %s %s", settings.llm_model, resp.status_code, resp.text[:300])
                return None
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
            text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
            text = re.sub(r"^\s*[\*\-]\s+", "• ", text, flags=re.MULTILINE)
            text = text.replace("`", "")
            detected = especie or _detect_especie(payload.message.lower(), payload.especie)
            return ChatResponse(reply=text, sources=["OpenAI " + settings.llm_model, "aquarismo.json"], model_used="openai", especie=detected, conversation_id=payload.conversation_id)
    except Exception as exc:
        logger.warning("LLM erro: %s", exc)
        return None


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request, db: Session = Depends(get_db)):
    if not payload.conversation_id:
        payload.conversation_id = str(uuid.uuid4())[:8]

    prev_state = _get_state(payload.conversation_id)
    turn = dialogue_state.extract_turn(payload.message, aquarismo_service.list_especies())
    if payload.especie and payload.especie.strip():
        canon = dialogue_state.canonical_especie(payload.especie)
        turn["especie"] = canon or payload.especie.strip().lower()
    if payload.volume_l is not None:
        turn["params"]["volume_l"] = payload.volume_l
    if payload.ph is not None:
        turn["params"]["ph"] = payload.ph
    if payload.gh is not None:
        turn["params"]["gh"] = payload.gh
    if payload.temperature is not None:
        turn["params"]["temp"] = payload.temperature
    if payload.turbidity is not None:
        turn["params"]["turbidity"] = payload.turbidity
    if payload.tds is not None:
        turn["params"]["tds"] = payload.tds
    if payload.companheiros:
        for c in payload.companheiros[:3]:
            cc = dialogue_state.canonical_especie(c)
            if cc and cc != turn.get("especie") and cc not in turn["companheiros"]:
                turn["companheiros"].append(cc)
    state = dialogue_state.merge_state(prev_state, turn)

    temp = turn["params"].get("temp", state.get("temp"))
    if payload.temperature is not None:
        temp = payload.temperature
    turb = turn["params"].get("turbidity", state.get("turbidity"))
    if payload.turbidity is not None:
        turb = payload.turbidity
    tds = turn["params"].get("tds", state.get("tds"))
    if payload.tds is not None:
        tds = payload.tds
    ph = turn["params"].get("ph", state.get("ph"))
    if payload.ph is not None:
        ph = payload.ph
    gh = turn["params"].get("gh", state.get("gh"))
    if payload.gh is not None:
        gh = payload.gh
    volume_eff = turn["params"].get("volume_l", state.get("volume_l"))
    if payload.volume_l is not None:
        volume_eff = payload.volume_l
    if volume_eff is not None:
        state["volume_l"] = volume_eff
    for k, v in (("ph", ph), ("gh", gh), ("temp", temp), ("tds", tds), ("turbidity", turb)):
        if v is not None:
            state[k] = v

    ml_info: dict = {}
    if payload.include_sensor_context and all(v is None for v in (temp, tds, turb, ph, gh)):
        try:
            from app.models import Reading

            last = db.query(Reading).order_by(Reading.timestamp.desc()).first()
            if last:
                temp, turb, tds = last.temperature, last.turbidity, last.tds
                if getattr(last, "prediction", None):
                    ml_info = {
                        "prediction": last.prediction,
                        "probability": getattr(last, "prediction_probability", None),
                        "anomaly": bool(getattr(last, "anomaly", False)),
                    }
        except Exception:
            pass

    especie_eff = state.get("especie") or turn.get("especie")
    context_msg = aquarismo_service.build_context_message(especie_eff, temp, turb, tds, ph=ph, gh=gh, volume_l=volume_eff)
    if ml_info.get("prediction"):
        prob = ml_info.get("probability")
        prob_txt = f" ({prob * 100:.0f}% confiança)" if isinstance(prob, (int, float)) else ""
        context_msg += f"\nModelo qualidade da água (estimativa, não certifica potabilidade): {ml_info['prediction']}{prob_txt}, anomalia={ml_info['anomaly']}."

    _conv_add(payload.conversation_id, "user", payload.message)
    _save_state(payload.conversation_id, state)

    if settings.llm_api_key:
        evidence = chat_retrieval.retrieve(especie_eff, state.get("last_intent"), segunda=state.get("segunda_especie"), top_k=3)
        oai = await _openai_reply(payload, temp, turb, tds, ph, context_msg, evidence, especie_eff)
        if oai:
            diag = aquarismo_service.diagnose(temp, turb, tds, especie_eff, ph=ph, gh=gh)
            oai.sources = list(dict.fromkeys(oai.sources + diag["sources"]))
            oai.state = state
            oai.evidence = evidence
            _conv_add(oai.conversation_id or payload.conversation_id, "assistant", oai.reply)
            _save_state(payload.conversation_id, state)
            return oai

    resp = _regras_reply(payload, temp, turb, tds, ph, gh, volume_eff, state)
    if ml_info.get("prediction") and "diagnóstico da água atual" in resp.reply.lower():
        prob = ml_info.get("probability")
        prob_txt = f" ({prob * 100:.0f}% confiança)" if isinstance(prob, (int, float)) else ""
        resp.reply += f"\n\nModelo: {ml_info['prediction']}{prob_txt} — estimativa estatística, não certifica potabilidade."
        resp.sources.append("Modelo qualidade da água (RandomForest + Isolation Forest)")
    _conv_add(payload.conversation_id, "assistant", resp.reply)
    _save_state(payload.conversation_id, state)
    if resp.state is None:
        resp.state = _get_state(payload.conversation_id)
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
    return {"conversation_id": conversation_id, "messages": entry["messages"], "count": len(entry["messages"]), "state": entry.get("state")}


@router.delete("/history/{conversation_id}")
def delete_history(conversation_id: str):
    if conversation_id in _CONVERSATIONS:
        _CONVERSATIONS.pop(conversation_id)
        return {"deleted": True, "conversation_id": conversation_id}
    raise HTTPException(status_code=404, detail="Conversa não encontrada.")
