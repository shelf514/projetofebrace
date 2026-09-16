import json
import logging
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "aquarismo.json"

logger = logging.getLogger("aquasense.aquarismo")

_fish_cache: list[dict] | None = None

# Thresholds
TURBIDEZ_ALERTA_NTU = 15.0  # aquário: >15 NTU indica filtração insuficiente (antes usava 5 NTU de água potável)
TDS_POTAVEL_MAX = 1000


def _load() -> list[dict]:
    global _fish_cache
    if _fish_cache is not None:
        return _fish_cache
    try:
        with open(DATA_PATH, encoding="utf-8") as f:
            data = json.load(f)
        # validação leve: filtra entradas sem especie/nome
        _fish_cache = [e for e in data if isinstance(e, dict) and e.get("especie") and e.get("nome")]
        if len(_fish_cache) != len(data):
            logger.warning("aquarismo.json: %d entradas inválidas ignoradas", len(data) - len(_fish_cache))
    except FileNotFoundError:
        logger.warning("aquarismo.json não encontrado em %s", DATA_PATH)
        _fish_cache = []
    except json.JSONDecodeError as exc:
        logger.error("aquarismo.json inválido: %s", exc)
        _fish_cache = []
    return _fish_cache


def reload_cache() -> None:
    global _fish_cache
    _fish_cache = None
    _load()


def list_especies() -> list[str]:
    return [f["especie"] for f in _load()]


def get_fish(especie: str) -> dict | None:
    especie = especie.strip().lower()
    for f in _load():
        if f["especie"].lower() == especie:
            return f
    return None


def suggest(especie: str) -> dict:
    fish = get_fish(especie)
    if not fish:
        return {"error": f"Espécie '{especie}' não encontrada. Tente: {', '.join(list_especies())}"}
    return fish


def diagnose(
    temperature: float | None,
    turbidity: float | None,
    tds: float | None,
    especie: str | None = None,
    ph: float | None = None,
    gh: float | None = None,
) -> dict:
    msgs: list[str] = []
    sources: list[str] = ["AquaSense: sensores DS18B20/turbidez/TDS"]

    fish = get_fish(especie) if especie else None

    if fish:
        # Temperatura
        if temperature is not None:
            if temperature < fish["temp_min"]:
                msgs.append(f"Temperatura {temperature:.1f}°C abaixo do ideal para {fish['nome']} ({fish['temp_min']}-{fish['temp_max']}°C) — aqueça gradualmente (1°C/h).")
                sources.append(f"{fish['nome']}: temp {fish['temp_min']}-{fish['temp_max']}°C")
            elif temperature > fish["temp_max"]:
                msgs.append(f"Temperatura {temperature:.1f}°C acima do ideal para {fish['nome']} ({fish['temp_min']}-{fish['temp_max']}°C) — resfrie/aumente oxigenação e reduza luz.")
                sources.append(f"{fish['nome']}: temp {fish['temp_min']}-{fish['temp_max']}°C")
        # TDS
        if tds is not None:
            if tds > fish["tds_max"]:
                msgs.append(f"TDS {tds:.0f} ppm acima do ideal para {fish['nome']} (<{fish['tds_max']} ppm) — trocas parciais 25% e verifique GH.")
                sources.append(f"{fish['nome']}: TDS até {fish['tds_max']} ppm")
            elif tds < fish["tds_min"]:
                msgs.append(f"TDS {tds:.0f} ppm baixo — pode faltar minerais (GH alvo {fish['gh_min']}-{fish['gh_max']}). Considere remineralizar.")
                sources.append(f"{fish['nome']}: TDS mínimo {fish['tds_min']} ppm")
        # pH (informado manualmente — sem sensor)
        if ph is not None:
            if ph < fish["ph_min"]:
                msgs.append(f"pH {ph:.1f} abaixo do ideal para {fish['nome']} ({fish['ph_min']}-{fish['ph_max']}) — água muito ácida; trocas com água mais alcalina ou substrato calcário.")
                sources.append(f"{fish['nome']}: pH {fish['ph_min']}-{fish['ph_max']}")
            elif ph > fish["ph_max"]:
                msgs.append(f"pH {ph:.1f} acima do ideal para {fish['nome']} ({fish['ph_min']}-{fish['ph_max']}) — água muito alcalina; use água deionizada/turfa gradualmente.")
                sources.append(f"{fish['nome']}: pH {fish['ph_min']}-{fish['ph_max']}")
        # GH
        if gh is not None:
            if gh < fish["gh_min"]:
                msgs.append(f"GH {gh:.0f} abaixo de {fish['gh_min']}-{fish['gh_max']} para {fish['nome']} — água muito mole; remineralize.")
                sources.append(f"{fish['nome']}: GH {fish['gh_min']}-{fish['gh_max']}")
            elif gh > fish["gh_max"]:
                msgs.append(f"GH {gh:.0f} acima de {fish['gh_min']}-{fish['gh_max']} para {fish['nome']} — água muito dura; dilua com água deionizada.")
                sources.append(f"{fish['nome']}: GH {fish['gh_min']}-{fish['gh_max']}")
        # Volume
        vol = fish.get("volume_min_l")
        if vol:
            sources.append(f"{fish['nome']}: volume mínimo {vol}L")

    # Turbidez — threshold de aquário (não potabilidade)
    if turbidity is not None and turbidity > TURBIDEZ_ALERTA_NTU:
        msgs.append(f"Turbidez {turbidity:.1f} NTU acima de {TURBIDEZ_ALERTA_NTU:.0f} NTU (aquário) — verifique filtração, alimentação excessiva e sifonagem.")
        sources.append(f"AquaSense aquário: turbidez ≤{TURBIDEZ_ALERTA_NTU:.0f} NTU (antes 5 NTU potável)")
    # TDS potável geral
    if tds is not None and tds > TDS_POTAVEL_MAX:
        msgs.append(f"TDS {tds:.0f} ppm acima de {TDS_POTAVEL_MAX} mg/L — água muito dura, trocas parciais.")
        sources.append(f"Portaria GM/MS 888/2021: TDS ≤{TDS_POTAVEL_MAX} mg/L")

    if not msgs:
        # mensagem positiva contextualizada
        if fish:
            msgs.append(f"Parâmetros dentro do ideal para {fish['nome']}. Mantenha trocas parciais 25% semanais e alimentação moderada.")
        else:
            msgs.append("Parâmetros dentro do esperado. Mantenha rotina de trocas parciais e alimentação moderada.")
    return {"alertas": msgs, "sources": sources}


def check_compatibilidade(especie_a: str, especie_b: str) -> dict:
    """Retorna compatibilidade entre duas espécies."""
    a = get_fish(especie_a)
    b = get_fish(especie_b)
    if not a or not b:
        missing = especie_a if not a else especie_b
        return {"compativel": None, "motivo": f"Espécie '{missing}' não encontrada na base.", "especies": [especie_a, especie_b]}
    ea = a["especie"].lower()
    eb = b["especie"].lower()
    if ea == eb:
        return {"compativel": False, "motivo": "Mesma espécie territorial (ex.: betta/kingui) — não mantenha dois machos juntos.", "especies": [ea, eb]}
    if eb in [x.lower() for x in a.get("incompativeis", [])] or ea in [x.lower() for x in b.get("incompativeis", [])]:
        return {"compativel": False, "motivo": f"{a['nome']} incompatível com {b['nome']} (temperamento/parâmetros/volume).", "especies": [ea, eb]}
    if eb in [x.lower() for x in a.get("compativeis", [])] or ea in [x.lower() for x in b.get("compativeis", [])]:
        return {"compativel": True, "motivo": f"{a['nome']} e {b['nome']} são compatíveis (parâmetros e comportamento semelhantes).", "especies": [ea, eb]}
    # Heurística por parâmetros: diferença grande de pH/temp impede
    ph_overlap = not (a["ph_max"] < b["ph_min"] or b["ph_max"] < a["ph_min"])
    temp_overlap = not (a["temp_max"] < b["temp_min"] or b["temp_max"] < a["temp_min"])
    if not ph_overlap or not temp_overlap:
        return {"compativel": False, "motivo": f"Parâmetros incompatíveis: pH {a['ph_min']}-{a['ph_max']} vs {b['ph_min']}-{b['ph_max']}, temp {a['temp_min']}-{a['temp_max']} vs {b['temp_min']}-{b['temp_max']}°C.", "especies": [ea, eb]}
    return {"compativel": None, "motivo": "Compatibilidade não catalogada — parâmetros sobrepõem, mas observe comportamento e volume.", "especies": [ea, eb]}


def recomendar(
    especie: str,
    volume_l: float | None = None,
    companheiros: list[str] | None = None,
    temperature: float | None = None,
    tds: float | None = None,
    ph: float | None = None,
) -> dict:
    fish = get_fish(especie)
    if not fish:
        return {"error": f"Espécie '{especie}' não encontrada. Tente: {', '.join(list_especies())}", "especie": especie}

    alertas: list[str] = []
    recomendacoes: list[str] = []

    # Volume
    vol_min = fish.get("volume_min_l", 40)
    if volume_l is not None and volume_l < vol_min:
        alertas.append(f"Aquário de {volume_l:.0f}L abaixo do mínimo {vol_min}L para {fish['nome']}. Considere espécies menores ou aquário maior.")
    elif volume_l is not None:
        recomendacoes.append(f"Volume {volume_l:.0f}L atende o mínimo {vol_min}L para {fish['nome']}.")
    else:
        recomendacoes.append(f"Volume mínimo recomendado: {vol_min}L (adulto {fish.get('tamanho_adulto_cm','?')} cm).")

    # Parâmetros ideais
    recomendacoes.append(f"pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}.")
    if fish.get("dieta"):
        recomendacoes.append(f"Dieta: {fish['dieta']}.")
    if fish.get("comportamento"):
        recomendacoes.append(f"Comportamento: {fish['comportamento']}.")
    if fish.get("dificuldade"):
        recomendacoes.append(f"Dificuldade: {fish['dificuldade']}.")

    # Diagnóstico se parâmetros atuais fornecidos
    if any(v is not None for v in (temperature, tds, ph)):
        diag = diagnose(temperature, None, tds, especie, ph=ph)
        alertas.extend(diag["alertas"])

    # Compatibilidade
    compat_result = []
    if companheiros:
        for comp in companheiros:
            c = check_compatibilidade(especie, comp.strip().lower())
            compat_result.append(c)
            if c["compativel"] is False:
                alertas.append(f"Incompatível com {comp}: {c['motivo']}")
            elif c["compativel"] is True:
                recomendacoes.append(f"Compatível com {comp}: {c['motivo']}")
            else:
                alertas.append(f"Compatibilidade com {comp} incerta: {c['motivo']}")

    fontelist = fish.get("fontes", [])
    return {
        "especie": fish["especie"],
        "nome": fish["nome"],
        "ficha": fish,
        "alertas": alertas,
        "recomendacoes": recomendacoes,
        "compatibilidade": compat_result,
        "fontes": fontelist,
    }


def build_context_message(especie: str | None, temperature, turbidity, tds, ph: float | None = None) -> str:
    parts = []
    if especie:
        fish = get_fish(especie)
        if fish:
            vol = fish.get("volume_min_l", "?")
            parts.append(
                f"Espécie consultada: {fish['nome']} (pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}, volume mínimo {vol}L). Dieta: {fish.get('dieta','—')}. Comportamento: {fish.get('comportamento','—')}. Dificuldade: {fish.get('dificuldade','—')}. Nota: {fish['notas']}"
            )
        else:
            parts.append(f"Espécie '{especie}' não encontrada na base. Responda com orientações gerais de aquarismo e sugira espécies similares entre {', '.join(list_especies()[:8])}.")
    if any(v is not None for v in (temperature, tds, turbidity, ph)):
        parts.append(f"Leitura atual do aquário: temp={temperature}°C, turbidez={turbidity} NTU, TDS={tds} ppm, pH={ph}.")
        diag = diagnose(temperature, turbidity, tds, especie, ph=ph)
        parts.append("Diagnóstico rápido: " + " | ".join(diag["alertas"]))
    return "\n".join(parts) if parts else "Sem contexto de sensores. Responda com base em aquarismo geral."
