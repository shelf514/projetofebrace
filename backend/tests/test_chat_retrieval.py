from app.services import chat_retrieval


def test_retrieve_ph_betta():
    evs = chat_retrieval.retrieve("betta", "ph")
    assert evs and evs[0]["campo"] == "pH" and "6.5" in evs[0]["valor"]
    c = chat_retrieval.cite(evs[0])
    assert "Betta" in c and "6.5-7.5" in c and "—" in c


def test_retrieve_unknown_empty_strict():
    assert chat_retrieval.retrieve("tubarao", "ph") == []
    assert chat_retrieval.retrieve(None, "ph") == []


def test_retrieve_compat_includes_segunda():
    evs = chat_retrieval.retrieve("betta", "compat", segunda="coridora", top_k=3)
    especies = [e["especie"] for e in evs]
    assert "betta" in especies and "coridora" in especies


def test_retrieve_top_k_cap():
    evs = chat_retrieval.retrieve("neon", None, top_k=2)
    assert len(evs) <= 2
