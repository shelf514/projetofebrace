import pytest
from fastapi.testclient import TestClient

from app import main as app_main


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    app_main._rate_store.clear()
    app_main._chat_rate_store.clear()
    app_main._aquarismo_rate_store.clear()
    app_main._predict_rate_store.clear()
    app_main._export_rate_store.clear()
    yield
    app_main._rate_store.clear()
    app_main._chat_rate_store.clear()
    app_main._aquarismo_rate_store.clear()
    app_main._predict_rate_store.clear()
    app_main._export_rate_store.clear()


def test_chat_ph_betta(client):
    r = client.post("/api/chat", json={"message": "pH ideal para betta?"})
    assert r.status_code == 200
    data = r.json()
    assert "6.5" in data["reply"] and "7.5" in data["reply"]
    assert data["model_used"] == "regras"
    assert data["especie"] == "betta"
    assert data["conversation_id"] is not None


def test_chat_tds_gh_temp_intents(client):
    for msg, needle in [
        ("TDS ideal para neon?", "250"),
        ("GH ideal para guppy?", "12"),
        ("temperatura ideal para kingui", "18"),
        ("turbidez alta no aquario?", "15 NTU"),
        ("volume mínimo para oscar?", "250L"),
        ("dieta do betta?", "artêmia"),
    ]:
        r = client.post("/api/chat", json={"message": msg})
        assert r.status_code == 200, f"{msg} -> {r.text}"
        assert needle.lower() in r.json()["reply"].lower(), f"{msg} faltou {needle}: {r.json()['reply']}"


def test_chat_compatibilidade(client):
    r = client.post("/api/chat", json={"message": "posso colocar betta com coridora em 60L?", "especie": "betta", "companheiros": ["coridora"]})
    assert r.status_code == 200
    assert "compat" in r.json()["reply"].lower()
    r2 = client.post("/api/chat", json={"message": "betta com kingui é compatível?", "companheiros": ["kingui"]})
    assert "incompat" in r2.json()["reply"].lower()


def test_chat_out_of_scope(client):
    r = client.post("/api/chat", json={"message": "qual a receita de bolo e filme para ver?"})
    assert r.status_code == 200
    assert "só respondo sobre aquarismo" in r.json()["reply"].lower()


def test_chat_out_of_scope_capital(client):
    r = client.post("/api/chat", json={"message": "qual a capital do Brasil?"})
    assert r.status_code == 200
    assert "só respondo sobre aquarismo" in r.json()["reply"].lower()


def test_chat_cohesion_fase_a(client):
    r = client.post("/api/chat", json={"message": "posso colocar betta com coridora em 60L?"})
    assert r.status_code == 200
    d = r.json()
    assert d["especie"] == "betta"
    assert "compat" in d["reply"].lower()
    assert (d["state"] or {}).get("volume_l") == 60
    r = client.post("/api/chat", json={"message": "bettas com kinguio é ok?"})
    assert r.status_code == 200
    d = r.json()
    assert "compat" in d["reply"].lower() and "kingui" in d["reply"].lower()
    cid = "fasea-vol"
    client.post("/api/chat", json={"message": "pH ideal para betta?", "conversation_id": cid})
    r2 = client.post("/api/chat", json={"message": "e em 60L?", "conversation_id": cid})
    assert r2.json()["especie"] == "betta"
    assert (r2.json()["state"] or {}).get("volume_l") == 60
    cid2 = "fasea-switch"
    client.post("/api/chat", json={"message": "pH ideal para betta?", "conversation_id": cid2})
    r3 = client.post("/api/chat", json={"message": "e para neon?", "conversation_id": cid2})
    assert r3.json()["especie"] == "neon"
    assert "6.0" in r3.json()["reply"]
    r4 = client.post("/api/chat", json={"message": "compatível?"})
    assert r4.status_code == 200
    assert r4.json()["followup"] is not None and "segunda espécie" in r4.json()["reply"]
    h = client.get(f"/api/chat/history/{cid2}")
    assert h.status_code == 200 and h.json().get("state", {}).get("especie") == "neon"


def test_chat_fase_b_citations(client):
    r = client.post("/api/chat", json={"message": "pH ideal para betta?", "include_sensor_context": False})
    assert r.status_code == 200
    d = r.json()
    assert d["evidence"], d
    ev = d["evidence"][0]
    assert ev["especie"] == "betta" and "6.5" in ev["valor"]
    assert any("—" in s and "6.5" in s for s in d["sources"]), d["sources"]
    r = client.post("/api/chat", json={"message": "posso colocar betta com coridora em 60L?", "include_sensor_context": False})
    d = r.json()
    assert {e["especie"] for e in d["evidence"]} >= {"betta", "coridora"}
    r = client.post("/api/chat", json={"message": "pH ideal?", "especie": "baleia", "include_sensor_context": False})
    d = r.json()
    assert "não está na base" in d["reply"]
    assert d["evidence"] == []


def test_chat_golden_file(client, auth_headers):
    import json
    from pathlib import Path
    client.post("/api/readings", headers=auth_headers, json={"device_id": "DEV-GOLD", "temperature": 27, "turbidity": 8, "tds": 200})
    path = Path(__file__).parent / "chat_golden.jsonl"
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        # golden tem dezenas de casos: limpa rate-limit a cada caso
        app_main._chat_rate_store.clear()
        app_main._rate_store.clear()
        case = json.loads(line)
        cid = case.get("conversation", f"gold-{abs(hash(line)) % 10**6}")
        for s in case.get("setup", []):
            client.post("/api/chat", json={"message": s["message"], "conversation_id": cid})
        body = {"message": case["message"], "conversation_id": cid, "include_sensor_context": case.get("sensor", False)}
        if case.get("especie"):
            body["especie"] = case["especie"]
        r = client.post("/api/chat", json=body)
        assert r.status_code == 200, f"{case['message']} -> {r.text}"
        d = r.json()
        exp = case.get("expect", {})
        if exp.get("especie"):
            assert d["especie"] == exp["especie"], f"{case['message']}: {d}"
        for needle in exp.get("needles", []):
            assert needle.lower() in d["reply"].lower(), f"{case['message']} faltou {needle}: {d['reply']}"
        if exp.get("state_volume") is not None:
            assert (d.get("state") or {}).get("volume_l") == exp["state_volume"], d
        if exp.get("followup"):
            assert d.get("followup"), d


def test_chat_conversation_history(client):
    r = client.post("/api/chat", json={"message": "pH para betta?", "conversation_id": "test123"})
    assert r.status_code == 200
    assert r.json()["conversation_id"] == "test123"
    r2 = client.post("/api/chat", json={"message": "e para neon?", "conversation_id": "test123"})
    assert r2.status_code == 200
    hist = client.get("/api/chat/history/test123")
    assert hist.status_code == 200
    assert hist.json()["count"] >= 4
    d = client.delete("/api/chat/history/test123")
    assert d.status_code == 200
    assert client.get("/api/chat/history/test123").status_code == 404


def test_chat_sensor_context(client, auth_headers, db_session):
    client.post("/api/readings", headers=auth_headers, json={"device_id": "DEV-CHAT", "temperature": 30, "turbidity": 20, "tds": 800})
    r = client.post("/api/chat", json={"message": "minha água está boa para betta?", "especie": "betta", "include_sensor_context": True})
    assert r.status_code == 200
    assert "diagnóstico" in r.json()["reply"].lower()


def test_chat_especies_list(client):
    r = client.get("/api/chat/especies")
    assert r.status_code == 200
    assert r.json()["total"] == 30
    assert any(e["especie"] == "betta" for e in r.json()["especies"])


def test_chat_new_species(client):
    for msg, needle in [
        ("pH ideal para acarabandeira?", "6.0"),
        ("posso colocar ramirezi com neon?", "compat"),
        ("barbo tigre com betta é compatível?", "incompat"),
        ("camarão red cherry com betta?", "incompat"),
        ("tanictis aguenta água fria?", "20"),
        ("rasbora estrela pH?", "5.0"),
        ("tricogaster chuna com colisa?", "compat"),
        ("rodostomo com neon?", "compat"),
        ("labeo bicolor precisa de quantos litros?", "120L"),
        ("botia palhaço tamanho adulto?", "30cm"),
        ("carpa koi com kingui?", "compat"),
        ("acará anão pH?", "5.0"),
        ("tetra cardi com neon?", "compat"),
        ("cascudo zebra temperatura?", "26"),
        ("guppy endler com guppy?", "compat"),
    ]:
        r = client.post("/api/chat", json={"message": msg})
        assert r.status_code == 200, f"{msg} -> {r.text}"
        assert needle.lower() in r.json()["reply"].lower(), f"{msg} faltou {needle}: {r.json()['reply']}"


def test_chat_guias(client):
    for msg, needles in [
        ("como ciclar o aquário?", ["ciclagem", "amônia"]),
        ("quanto tempo leva a ciclagem?", ["4", "8", "semanas"]),
        ("o que é new tank syndrome?", ["new tank", "síndrome", "amônia"]),
        ("fazer troca parcial de água", ["25%", "semana"]),
        ("com que frequência trocar a água?", ["25%", "seman"]),
        ("meu peixe está com pontos brancos", ["íctio", "28", "30"]),
        ("peixe com fungo", ["fungo", "antifúngico"]),
        ("como testar o pH da água?", ["parâmetros", "ph"]),
        ("água dura ou mole para betta?", ["mole", "macia"]),
        ("posso usar água da torneira?", ["declorada", "condicionador", "cloro"]),
        ("plantas para aquário", ["plantas", "substrato"]),
        ("iluminação do aquário", ["led", "iluminação", "luz"]),
        ("vazão do filtro para 100L", ["400", "600", "L/h"]),
        ("limpar filtro com torneira?", ["torneira", "cloro", "bactérias"]),
        ("alimentar peixe 1x por dia", ["1-2x", "2 min"]),
        ("peixe jejum", ["jejum", "1x", "semana"]),
        ("quarentena de peixes novos", ["quarentena", "2 semanas"]),
    ]:
        r = client.post("/api/chat", json={"message": msg})
        assert r.status_code == 200, f"{msg} -> {r.text}"
        for needle in needles:
            assert needle.lower() in r.json()["reply"].lower(), f"{msg} faltou {needle}: {r.json()['reply']}"


def test_chat_multi_intent(client):
    r = client.post("/api/chat", json={"message": "pH ideal para betta em 60L?"})
    assert r.status_code == 200
    d = r.json()
    assert d["especie"] == "betta"
    assert "6.5" in d["reply"]
    assert (d["state"] or {}).get("volume_l") == 60


def test_chat_alias_resolution(client):
    r = client.post("/api/chat", json={"message": "peixe dourado com beta?"})
    assert r.status_code == 200
    d = r.json()
    assert d["especie"] == "kingui"
    assert "compat" in d["reply"].lower()


def test_aquarismo_compatibilidade_endpoint(client):
    r = client.get("/api/aquarismo/compatibilidade?especie_a=betta&especie_b=coridora")
    assert r.status_code == 200
    assert r.json()["compativel"] is True
    r2 = client.get("/api/aquarismo/compatibilidade?especie_a=betta&especie_b=kingui")
    assert r2.json()["compativel"] is False


def test_aquarismo_recomendar_volume(client):
    r = client.post("/api/aquarismo/recomendar", json={"especie": "oscar", "volume_l": 50})
    assert r.status_code == 200
    assert any("abaixo do mínimo" in a for a in r.json()["alertas"])
    r2 = client.post("/api/aquarismo/recomendar", json={"especie": "betta", "volume_l": 60, "companheiros": ["coridora"]})
    assert r2.status_code == 200
    assert r2.json()["especie"] == "betta"
