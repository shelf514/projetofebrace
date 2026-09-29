"""Estado de diálogo para o chat de aquarismo (Fase C).

NLU offline-first: RapidFuzz + aliases expandidos + multi-intent + slot-filling.
Sem rede, sem embeddings. Stdlib + rapidfuzz.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from rapidfuzz import fuzz

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

ALIASES: dict[str, list[str]] = {}
_alias_to_canonical: dict[str, str] = {}
_aliases_loaded = False


def _load_aliases() -> None:
    global _aliases_loaded
    if _aliases_loaded:
        return
    try:
        with open(DATA_DIR / "aliases.json", encoding="utf-8") as f:
            raw = json.load(f)
        for canonical, names in raw.items():
            ALIASES[canonical] = names
            for name in names:
                _alias_to_canonical[normalize_text(name)] = canonical
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    _aliases_loaded = True


FUZZY_CUTOFF = 85

VOLUME_RE = re.compile(r"(\d+[.,]?\d*)\s?(l\b|litros?\b)", re.IGNORECASE)
PH_RE = re.compile(r"ph\s?(\d+[.,]\d+|\d+)", re.IGNORECASE)
PH_STANDALONE_RE = re.compile(r"\b(\d+[.,]\d+)\s*(?:de\s*)?ph\b", re.IGNORECASE)
GH_RE = re.compile(r"gh\s?(\d+[.,]?\d*)", re.IGNORECASE)
TDS_RE = re.compile(r"tds\s?(\d+[.,]?\d*)", re.IGNORECASE)
TEMP_RE = re.compile(r"(\d+[.,]?\d*)\s?°?\s?c\b", re.IGNORECASE)
TEMP_CTX_RE = re.compile(r"\btemp\b|temperatura|quente|frio|aquec|graus|grau", re.IGNORECASE)
TURB_RE = re.compile(r"turbidez\s?(?:de\s?|em\s?)?(\d+[.,]?\d*)", re.IGNORECASE)
TURB_STANDALONE_RE = re.compile(r"(\d+[.,]?\d*)\s?ntu\b", re.IGNORECASE)

INTENT_KEYWORDS: dict[str, list[str]] = {
    "compat": ["compat", "compativel", "compatibilidade", "compativeis", "posso colocar", "junto com", "misturar", "convive", "junto"],
    "ph": ["ph"],
    "gh": ["gh", "dureza", "dura", "mole", "moles", "macia"],
    "tds": ["tds", "solidos", "sólidos"],
    "temp": ["temperatura", "temp", "quente", "quentes", "frio", "fria", "frios", "frias", "aquec"],
    "turbidez": ["turbidez", "turbidity", "ntu", "turva", "turvo"],
    "volume": ["volume", "litro", "litros", "tamanho aquario", "tamanho aquário", "l\b"],
    "dieta": ["aliment", "alimentacao", "alimentar", "racao", "ração", "comida", "dieta", "come", "comer", "flakes", "pellets", "jejum"],
    "manutencao": ["troca", "trocas", "trocar", "filtragem", "filtro", "filtros", "sifon", "sifao", "limpeza", "limpar", "manutencao", "manutenção", "torneira", "cloro", "declorada", "condicionador"],
    "dificuldade": ["dificuldade", "iniciante", "avancado", "avançado", "facil", "fácil", "dificil", "difícil", "resistente", "espelho", "comportamento", "territorial", "agressivo"],
    "diagnostico": ["agua", "esta boa", "esta bom", "diagnostico", "diagnóstico", "sensor", "como esta", "testar", "teste", "amonia", "nitrito", "nitrato"],
    "ciclagem": ["ciclo", "ciclagem", "ciclar", "bacteria", "bactéria", "nova", "novo", "montar", "montagem"],
    "newtank": ["new tank", "newtank", "sindrome", "síndrome"],
    "doenca": ["doenca", "doença", "doente", "ictio", "íctio", "fungo", "hidropsia", "pontos brancos", "tratamento", "remedio", "remédio", "quarentena", "morrendo", "morto"],
    "equipamento": ["filtro", "bomba", "aquecedor", "iluminacao", "iluminação", "led", "substrato", "plantas", "decoracao", "decoração"],
}

OUT_OF_SCOPE_PATTERNS = [
    r"\breceita\b", r"\bfutebol\b", r"\bpolitica\b", r"\bpolítica\b", r"\bprogramacao\b", r"\bprogramação\b",
    r"\bfilme\b", r"\bserie\b", r"\bsérie\b", r"\bmusica\b", r"\bmúsica\b", r"\bjogo\b", r"\bgame\b",
    r"\bcriptomoeda\b", r"\bbitcoin\b", r"\beleicao\b", r"\beleição\b", r"\bnoticia\b", r"\bnotícia\b",
    r"\bclima\b", r"\btempo\b", r"\bremedio\b", r"\bremédio\b", r"\breceita medica\b", r"\breceita médica\b",
    r"\bcapital\b", r"\bcidade\b", r"\bpais\b", r"\bpaís\b", r"\bhistoria\b", r"\bhistória\b",
    r"\bmatematica\b", r"\bmatemática\b", r"\bfisica\b", r"\bfísica\b", r"\bquimica\b", r"\bquímica\b",
]

AQUARISMO_KEYWORDS = [
    "ph", "gh", "tds", "turbidez", "turbidity", "temperatura", "temp",
    "aquario", "aquário", "peixe", "betta", "neon", "guppy", "volum", "litro",
    "compat", "compativel", "compatibilidade", "aliment", "alimentacao", "racao", "ração",
    "dieta", "troca", "filtragem", "filtro", "fria", "quente",
    "especie", "espécie", "kingui", "cascudo", "coridora", "acaradisco", "oscar",
    "ciclo", "ciclagem", "amonia", "amônia", "nitrito", "nitrato", "doenca", "doença",
    "filtro", "bomba", "aquecedor", "plantas", "substrato",
]


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize_text(msg: str) -> str:
    """lower + sem acento + espaços simples."""
    s = _strip_accents(msg.lower())
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _to_float(raw: str) -> float | None:
    try:
        return float(raw.replace(",", "."))
    except (ValueError, AttributeError):
        return None


def canonical_especie(token: str) -> str | None:
    """Resolve token → espécie canônica (alias exato ou fuzzy)."""
    _load_aliases()
    t = normalize_text(token)
    if not t:
        return None
    if t in _alias_to_canonical:
        return _alias_to_canonical[t]
    for canonical, names in ALIASES.items():
        if t == normalize_text(canonical):
            return canonical
    return None


def extract_all_especies(msg: str, known: list[str]) -> list[str]:
    """Todas as espécies na ordem de aparição (alias → exato → fuzzy)."""
    _load_aliases()
    norm = normalize_text(msg)
    found: list[str] = []

    def push(esp: str):
        if esp not in found:
            found.append(esp)

    # 1. alias exato (word-boundary no início e fim)
    for alias, canon in _alias_to_canonical.items():
        if canon in known and re.search(rf"\b{re.escape(alias)}\b", norm, re.IGNORECASE):
            push(canon)

    # 2. nome canônico exato
    for esp in known:
        if re.search(rf"\b{re.escape(_strip_accents(esp))}\b", norm):
            push(esp)

    if found:
        pos: dict[str, tuple[int, int]] = {}
        for esp in found:
            variants = [esp] + [a for a, c in _alias_to_canonical.items() if c == esp]
            best = (10**9, 0)
            for v in variants:
                idx = norm.find(v)
                if idx >= 0 and (idx, -len(v)) < best:
                    best = (idx, -len(v))
            pos[esp] = best
        return sorted(found, key=lambda e: pos[e])

    # 3. fuzzy por palavra/bigrama (ignora palavras muito curtas)
    words = re.findall(r"[a-z]+(?:[ -][a-z]+)?", norm)
    for w in words:
        if len(w) < 3:
            continue
        w_canon = _alias_to_canonical.get(w, w)
        if w_canon in known:
            push(w_canon)
            continue
        best_score = 0
        best_match = None
        for esp in known:
            score = fuzz.WRatio(w_canon, esp)
            if score > best_score:
                best_score = score
                best_match = esp
        if best_match and best_score >= FUZZY_CUTOFF:
            push(best_match)
    return found


def extract_params(msg: str) -> dict:
    """volume_l, ph, gh, tds, temp, turbidez a partir do texto."""
    out: dict = {}
    m = VOLUME_RE.search(msg)
    if m:
        v = _to_float(m.group(1))
        if v is not None and 1 <= v <= 10000:
            out["volume_l"] = v
    m = PH_RE.search(msg)
    if m:
        v = _to_float(m.group(1))
        if v is not None and 0 <= v <= 14:
            out["ph"] = v
    else:
        m = PH_STANDALONE_RE.search(msg)
        if m:
            v = _to_float(m.group(1))
            if v is not None and 0 <= v <= 14:
                out["ph"] = v
    m = GH_RE.search(msg)
    if m:
        v = _to_float(m.group(1))
        if v is not None and 0 <= v <= 50:
            out["gh"] = v
    m = TDS_RE.search(msg)
    if m:
        v = _to_float(m.group(1))
        if v is not None and 0 <= v <= 10000:
            out["tds"] = v
    m = TEMP_RE.search(msg)
    if m:
        v = _to_float(m.group(1))
        if v is not None and -10 <= v <= 60:
            if TEMP_CTX_RE.search(msg) or "temp" in msg.lower() or "°c" in msg.lower():
                out["temp"] = v
    m = TURB_RE.search(msg)
    if m and m.group(1):
        v = _to_float(m.group(1))
        if v is not None and 0 <= v <= 1000:
            out["turbidity"] = v
    else:
        m = TURB_STANDALONE_RE.search(msg)
        if m:
            v = _to_float(m.group(1))
            if v is not None and 0 <= v <= 1000:
                out["turbidity"] = v
    return out


def detect_intents(msg: str) -> list[str]:
    """Multi-intent: retorna lista de intents detectados (ordem de prioridade)."""
    msg_norm = normalize_text(msg)
    intents: list[str] = []
    for intent, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", msg_norm):
                intents.append(intent)
                break
    if re.search(r"\d+\s*(l|litros?)\b", msg_norm):
        if "volume" not in intents:
            intents.append("volume")
    return intents


def is_aquarismo(msg_norm: str) -> bool:
    """Verifica se a mensagem é sobre aquarismo (regex word-boundary)."""
    for kw in AQUARISMO_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", msg_norm):
            return True
    return False


def is_out_of_scope(msg_norm: str) -> bool:
    """Verifica se a mensagem é fora do escopo."""
    for pattern in OUT_OF_SCOPE_PATTERNS:
        if re.search(pattern, msg_norm):
            return True
    return False


def new_state() -> dict:
    return {
        "especie": None,
        "segunda_especie": None,
        "volume_l": None,
        "ph": None,
        "gh": None,
        "temp": None,
        "tds": None,
        "turbidity": None,
        "companheiros": [],
        "last_intent": None,
    }


def extract_turn(msg: str, known: list[str]) -> dict:
    """Extração de um turno: espécies + params + intents."""
    norm = normalize_text(msg)
    especies = extract_all_especies(msg, known)
    params = extract_params(msg)
    companheiros = especies[1:4] if len(especies) > 1 else []
    intents = detect_intents(norm)
    return {
        "especies": especies,
        "especie": especies[0] if especies else None,
        "segunda_especie": especies[1] if len(especies) > 1 else None,
        "companheiros": companheiros,
        "params": params,
        "intents": intents,
        "intent": intents[0] if intents else None,
    }


def merge_state(state: dict, turn: dict) -> dict:
    """Merge turno → estado (menção nova sobrescreve; ausência herda)."""
    merged = {**new_state(), **(state or {})}
    merged["companheiros"] = list((state or {}).get("companheiros", []))[:3]
    if turn.get("especie"):
        if merged["especie"] and turn["especie"] != merged["especie"]:
            merged["segunda_especie"] = None
            merged["companheiros"] = []
        merged["especie"] = turn["especie"]
    if turn.get("segunda_especie"):
        merged["segunda_especie"] = turn["segunda_especie"]
    for comp in turn.get("companheiros", []):
        if comp != merged.get("especie") and comp not in merged["companheiros"]:
            merged["companheiros"].append(comp)
    merged["companheiros"] = merged["companheiros"][:3]
    for k in ("volume_l", "ph", "gh", "temp", "tds", "turbidity"):
        if turn.get("params", {}).get(k) is not None:
            merged[k] = turn["params"][k]
    if turn.get("intent"):
        merged["last_intent"] = turn["intent"]
    return merged


def followup_for(state: dict, intents: list[str]) -> str | None:
    """1 pergunta quando falta slot (None = sem follow-up)."""
    primary = intents[0] if intents else None
    if primary == "compat" and not state.get("segunda_especie") and not state.get("companheiros"):
        return "Qual a segunda espécie? Ex.: 'posso colocar betta com coridora em 60L?'"
    if primary == "volume" and not state.get("especie"):
        return "Para qual espécie? Ex.: 'volume mínimo para oscar?'"
    if primary == "diagnostico" and not any(
        state.get(k) is not None for k in ("ph", "gh", "temp", "tds", "turbidity", "volume_l")
    ):
        return "Qual pH/GH/volume? Ex.: 'pH 7.0, 60L, com betta?'"
    return None


_load_aliases()
