import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "aquarismo.json"

_fish_cache: list[dict] | None = None


def _load() -> list[dict]:
    global _fish_cache
    if _fish_cache is not None:
        return _fish_cache
    try:
        with open(DATA_PATH, encoding="utf-8") as f:
            _fish_cache = json.load(f)
    except FileNotFoundError:
        _fish_cache = []
    return _fish_cache


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


def diagnose(temperature: float | None, turbidity: float | None, tds: float | None, especie: str | None = None) -> dict:
    msgs: list[str] = []
    sources: list[str] = ["AquaSense: sensores DS18B20/turbidez/TDS"]
    if especie:
        fish = get_fish(especie)
        if fish and temperature is not None:
            if temperature < fish["temp_min"]:
                msgs.append(f"Temperatura {temperature:.1f}°C abaixo do ideal para {fish['nome']} ({fish['temp_min']}-{fish['temp_max']}°C) — aqueça gradualmente.")
                sources.append(f"{fish['nome']}: temp {fish['temp_min']}-{fish['temp_max']}°C")
            elif temperature > fish["temp_max"]:
                msgs.append(f"Temperatura {temperature:.1f}°C acima do ideal para {fish['nome']} ({fish['temp_min']}-{fish['temp_max']}°C) — resfrie/aumente oxigenação.")
                sources.append(f"{fish['nome']}: temp {fish['temp_min']}-{fish['temp_max']}°C")
        if fish and tds is not None:
            if tds > fish["tds_max"]:
                msgs.append(f"TDS {tds:.0f} ppm acima do ideal para {fish['nome']} (<{fish['tds_max']} ppm) — trocas parciais 25% e verifique GH.")
                sources.append(f"{fish['nome']}: TDS até {fish['tds_max']} ppm")
            elif tds < fish["tds_min"]:
                msgs.append(f"TDS {tds:.0f} ppm baixo — pode faltar minerais (GH {fish['gh_min']}-{fish['gh_max']}).")
    if turbidity is not None and turbidity > 5:
        msgs.append(f"Turbidez {turbidity:.1f} NTU acima de 5 NTU (Portaria 888/2021 para água potável) — verifique filtração/partículas.")
        sources.append("Portaria GM/MS 888/2021: turbidez ≤5 NTU")
    if tds is not None and tds > 1000:
        msgs.append(f"TDS {tds:.0f} ppm acima de 1000 mg/L — água muito dura, trocas parciais.")
        sources.append("Portaria 888/2021: TDS ≤1000 mg/L")
    if not msgs:
        msgs.append("Parâmetros dentro do esperado para espécie/legislação consultada. Mantenha rotina de trocas parciais e alimentação moderada.")
    return {"alertas": msgs, "sources": sources}


def build_context_message(especie: str | None, temperature, turbidity, tds) -> str:
    parts = []
    if especie:
        fish = get_fish(especie)
        if fish:
            parts.append(f"Espécie consultada: {fish['nome']} (pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}). Nota: {fish['notas']}")
        else:
            parts.append(f"Espécie '{especie}' não encontrada na base. Responda com orientações gerais de aquarismo e sugira espécies similares.")
    if temperature is not None or tds is not None or turbidity is not None:
        parts.append(f"Leitura atual do aquário: temp={temperature}°C, turbidez={turbidity} NTU, TDS={tds} ppm.")
        diag = diagnose(temperature, turbidity, tds, especie)
        parts.append("Diagnóstico rápido: " + " | ".join(diag["alertas"]))
    return "\n".join(parts) if parts else "Sem contexto de sensores. Responda com base em aquarismo geral."
