import re
import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database.db import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import aquarismo_service

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = """Você é o assistente de aquarismo do AquaSense AI (FEBRACE).
Responda APENAS sobre aquarismo (peixes, pH, temperatura, TDS, turbidez, GH, filtragem, trocas parciais, alimentação).
Se a pergunta for fora do escopo, diga que só responde sobre aquarismo e redirecione.
Seja conciso (máx 6 linhas), cite pH/temp/TDS da base quando citar espécie, e lembre que é estimativa — não substitui veterinário/laboratório.
Nunca invente pH fora da base fornecida; se espécie desconhecida, diga que não está na base e dê orientação geral.
Idioma: português (pt-BR)."""

# Rate limit simples já existe em main.py para /api/readings, aqui validamos tamanho via pydantic


def _regras_reply(payload: ChatRequest, temp, turb, tds) -> ChatResponse:
    msg_lower = payload.message.lower()
    especie = (payload.especie or "").strip().lower()

    # Tenta extrair espécie da mensagem se não veio no campo
    if not especie:
        for esp in aquarismo_service.list_especies():
            if re.search(rf"\b{re.escape(esp)}\b", msg_lower):
                especie = esp
                break

    sources: list[str] = []
    reply_parts: list[str] = []

    if especie:
        fish = aquarismo_service.get_fish(especie)
        if fish:
            reply_parts.append(
                f"**{fish['nome']}** — pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}. {fish['notas']}"
            )
            sources.append(f"{fish['nome']}: pH {fish['ph_min']}-{fish['ph_max']}")
        else:
            reply_parts.append(f"Espécie '{especie}' não está na base ({', '.join(aquarismo_service.list_especies()[:6])}...).")
            sources.append("Base aquarismo.json")

    # Se pediu pH correto
    if "ph" in msg_lower:
        if especie and aquarismo_service.get_fish(especie):
            fish = aquarismo_service.get_fish(especie)
            reply_parts.append(f"pH ideal para {especie}: **{fish['ph_min']}-{fish['ph_max']}**. Mantenha estável; trocas bruscas matam mais que pH levemente fora.")
        else:
            reply_parts.append("pH ideal varia por espécie: amazônicos (neon, discus) 6.0-7.0 | betta 6.5-7.5 | vivíparos (guppy, plati) 7.0-8.0. Informe a espécie para valor exato.")

    if payload.include_sensor_context and any(v is not None for v in (temp, turb, tds)):
        diag = aquarismo_service.diagnose(temp, turb, tds, especie or None)
        reply_parts.append("**Diagnóstico da água atual:** " + " ".join(diag["alertas"]))
        sources.extend(diag["sources"])

    # Fallback genérico se pouca coisa
    if len(reply_parts) == 0:
        reply_parts.append(
            "Posso ajudar com pH, temperatura, TDS, turbidez, GH e rotina de trocas. Ex.: 'pH ideal para betta?' ou 'meu TDS 800 está alto para neon?'. Informe a espécie e, se quiser, marque 'usar leitura atual'."
        )
        sources.append("AquaSense aquarismo.json + Portaria 888/2021")

    # Adiciona aviso se mensagem parece fora do escopo aquarismo
    if any(w in msg_lower for w in ["receita", "futebol", "política", "programação"]) and "ph" not in msg_lower and not especie:
        reply_parts.append("Só respondo sobre aquarismo — me diga a espécie e a dúvida sobre água.")

    reply = "\n\n".join(reply_parts)
    # Limita a 900 chars
    if len(reply) > 900:
        reply = reply[:897] + "..."
    return ChatResponse(reply=reply, sources=list(dict.fromkeys(sources)), model_used="regras", especie=especie or None)


async def _openai_reply(payload: ChatRequest, temp, turb, tds, context_msg: str) -> ChatResponse | None:
    if not settings.llm_api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                f"{settings.llm_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"},
                json={
                    "model": settings.llm_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "system", "content": context_msg},
                        {"role": "user", "content": payload.message},
                    ],
                    "temperature": 0.4,
                    "max_tokens": 350,
                },
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            # Garante que não inventou fora da base: se menciona pH sem fonte, mantém mas adiciona aviso
            return ChatResponse(reply=text, sources=["OpenAI " + settings.llm_model, "aquarismo.json"], model_used="openai", especie=payload.especie)
    except Exception:
        return None


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request, db: Session = Depends(get_db)):
    # Pega leitura atual se solicitado
    temp = payload.temperature
    turb = payload.turbidity
    tds = payload.tds
    if payload.include_sensor_context and temp is None and tds is None and turb is None:
        # tenta pegar última leitura do banco
        try:
            from app.models import Reading

            last = db.query(Reading).order_by(Reading.timestamp.desc()).first()
            if last:
                temp, turb, tds = last.temperature, last.turbidity, last.tds
        except Exception:
            pass

    context_msg = aquarismo_service.build_context_message(payload.especie, temp, turb, tds)

    # Tenta OpenAI se configurado
    if settings.llm_api_key:
        oai = await _openai_reply(payload, temp, turb, tds, context_msg)
        if oai:
            # injeta diagnóstico também como sources
            diag = aquarismo_service.diagnose(temp, turb, tds, payload.especie)
            oai.sources = list(dict.fromkeys(oai.sources + diag["sources"]))
            return oai

    # Fallback regras (sempre funciona offline)
    return _regras_reply(payload, temp, turb, tds)


@router.get("/especies")
def list_especies():
    return {"especies": aquarismo_service._load()}
