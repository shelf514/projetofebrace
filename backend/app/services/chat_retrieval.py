"""RAG lexical estrito para o chat de aquarismo (Fase C).

Sem vetores/embeddings: índice por campo sobre backend/data/aquarismo.json
+ guias temáticos de backend/data/guias.json.
Toda afirmação numérica da resposta deve vir de uma evidência aqui.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.services import aquarismo_service

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

INTENT_FIELDS: dict[str, list[str]] = {
    "ph": ["pH"],
    "gh": ["GH"],
    "tds": ["TDS"],
    "temp": ["temperatura"],
    "turbidez": ["turbidez"],
    "volume": ["volume"],
    "dieta": ["dieta"],
    "dificuldade": ["dificuldade", "comportamento"],
    "compat": ["compatibilidade"],
    "diagnostico": ["diagnóstico"],
    "manutencao": ["manutenção"],
    "ciclagem": ["ciclagem"],
    "newtank": ["newtank"],
    "doenca": ["doença"],
    "equipamento": ["equipamento"],
}

FIELD_LABEL: dict[str, str] = {
    "pH": "pH",
    "temperatura": "temp",
    "TDS": "TDS",
    "GH": "GH",
    "volume": "volume mín",
    "dieta": "dieta",
    "comportamento": "comportamento",
    "dificuldade": "dificuldade",
    "compatibilidade": "compatibilidade",
    "turbidez": "turbidez",
    "diagnóstico": "diagnóstico",
    "manutenção": "manutenção",
    "ciclagem": "ciclagem",
    "doença": "doença",
    "equipamento": "equipamento",
    "ficha": "ficha",
}

_guias_cache: list[dict] | None = None


def _load_guias() -> list[dict]:
    global _guias_cache
    if _guias_cache is not None:
        return _guias_cache
    try:
        with open(DATA_DIR / "guias.json", encoding="utf-8") as f:
            _guias_cache = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        _guias_cache = []
    return _guias_cache


def get_guia(guia_id: str) -> dict | None:
    """Retorna guia temático por id (ex.: 'ciclagem', 'tpa', 'doencas')."""
    for guia in _load_guias():
        if guia.get("id") == guia_id:
            return guia
    return None


def _fonte(fish: dict) -> str:
    fontes = fish.get("fontes") or []
    return fontes[0] if fontes else "AquaSense aquarismo.json"


def _ev(especie: str, nome: str, campo: str, valor: str, fonte: str) -> dict:
    return {
        "especie": especie,
        "nome": nome,
        "campo": campo,
        "valor": valor,
        "fonte": fonte,
        "texto": f"{campo} {valor}".strip(),
    }


def chunks_for(fish: dict) -> dict[str, dict]:
    """Todos os chunks de uma espécie, chaveados por campo."""
    esp, nome, fonte = fish["especie"], fish["nome"], _fonte(fish)
    vol = fish.get("volume_min_l", "?")
    return {
        "pH": _ev(esp, nome, "pH", f"{fish['ph_min']}-{fish['ph_max']}", fonte),
        "temperatura": _ev(esp, nome, "temp", f"{fish['temp_min']}-{fish['temp_max']}°C", fonte),
        "TDS": _ev(esp, nome, "TDS", f"até {fish['tds_max']} ppm (mín {fish['tds_min']} ppm)", fonte),
        "GH": _ev(esp, nome, "GH", f"{fish['gh_min']}-{fish['gh_max']}", fonte),
        "volume": _ev(
            esp,
            nome,
            "volume mín",
            f"{vol}L (adulto {fish.get('tamanho_adulto_cm', '?')} cm)",
            fonte,
        ),
        "dieta": _ev(esp, nome, "dieta", str(fish.get("dieta", "—")), fonte),
        "comportamento": _ev(esp, nome, "comportamento", str(fish.get("comportamento", "—")), fonte),
        "dificuldade": _ev(
            esp,
            nome,
            "dificuldade",
            f"{fish.get('dificuldade', '—')} — {fish.get('comportamento', '')}".strip(),
            fonte,
        ),
        "compatibilidade": _ev(
            esp,
            nome,
            "compatibilidade",
            f"compatíveis: {', '.join(fish.get('compativeis', [])[:5]) or '—'}; incompatíveis: {', '.join(fish.get('incompativeis', [])[:5]) or '—'}",
            fonte,
        ),
        "ficha": _ev(
            esp,
            nome,
            "ficha",
            f"pH {fish['ph_min']}-{fish['ph_max']}, temp {fish['temp_min']}-{fish['temp_max']}°C, "
            f"TDS até {fish['tds_max']} ppm, GH {fish['gh_min']}-{fish['gh_max']}, vol. mín {vol}L",
            fonte,
        ),
    }


def retrieve(especie: str | None, intent: str | None, segunda: str | None = None, top_k: int = 3) -> list[dict]:
    """Evidências ordenadas: campos do intent primeiro; 2ª espécie incluída em compat."""
    if not especie:
        return []
    fish = aquarismo_service.get_fish(especie)
    if not fish:
        return []
    chunks = chunks_for(fish)
    fields = INTENT_FIELDS.get(intent or "", []) or ["ficha"]
    out: list[dict] = [chunks[f] for f in fields if f in chunks]
    if intent == "compat" and segunda:
        fish2 = aquarismo_service.get_fish(segunda)
        if fish2:
            chunks2 = chunks_for(fish2)
            out.extend([chunks2[f] for f in ("ficha", "compatibilidade") if f in chunks2][:2])
    if len(out) < top_k and "ficha" not in [e["campo"] for e in out]:
        out.append(chunks["ficha"])
    return out[: max(top_k, 1)]


def cite(ev: dict) -> str:
    """Citação verificável: fonte + nome + campo + valor."""
    return f"{ev['fonte']} — {ev['nome']}: {ev['texto']}"
