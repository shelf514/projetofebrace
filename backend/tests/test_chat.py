import pytest
from fastapi.testclient import TestClient


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


def test_chat_conversation_history(client):
    r = client.post("/api/chat", json={"message": "pH para betta?", "conversation_id": "test123"})
    assert r.status_code == 200
    assert r.json()["conversation_id"] == "test123"
    r2 = client.post("/api/chat", json={"message": "e para neon?", "conversation_id": "test123"})
    assert r2.status_code == 200
    hist = client.get("/api/chat/history/test123")
    assert hist.status_code == 200
    assert hist.json()["count"] >= 4  # 2 user + 2 assistant
    # delete
    d = client.delete("/api/chat/history/test123")
    assert d.status_code == 200
    assert client.get("/api/chat/history/test123").status_code == 404


def test_chat_sensor_context(client, auth_headers, db_session):
    # injeta leitura via api real
    client.post("/api/readings", headers=auth_headers, json={"device_id": "DEV-CHAT", "temperature": 30, "turbidity": 20, "tds": 800})
    r = client.post("/api/chat", json={"message": "minha água está boa para betta?", "especie": "betta", "include_sensor_context": True})
    assert r.status_code == 200
    assert "diagnóstico" in r.json()["reply"].lower()


def test_chat_especies_list(client):
    r = client.get("/api/chat/especies")
    assert r.status_code == 200
    assert r.json()["total"] == 15
    assert any(e["especie"] == "betta" for e in r.json()["especies"])


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
