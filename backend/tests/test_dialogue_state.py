from app.services import dialogue_state as ds

KNOWN = ["betta", "neon", "coridora", "kingui", "oscar", "guppy", "cascudo", "plati", "acarabandeira", "ramirezi", "barbotigre", "camarao", "tanictis", "rasbora", "tricogaster", "rodostomo", "labeo", "botia", "carpakoi", "acaraano", "tetacardi", "cascudozebra", "guppyendler"]


def test_normalize_accents():
    assert ds.normalize_text("AcARÁ-DISCO! ") == "acara-disco!"


def test_extract_exact_order():
    assert ds.extract_all_especies("posso colocar neon com betta?", KNOWN) == ["neon", "betta"]


def test_extract_fuzzy_plural_synonym():
    assert ds.extract_all_especies("bettas com kinguio é ok?", KNOWN) == ["betta", "kingui"]
    assert ds.extract_all_especies("coridoras com betta?", KNOWN) == ["coridora", "betta"]


def test_extract_aliases():
    assert ds.extract_all_especies("peixe dourado com beta?", KNOWN) == ["kingui", "betta"]
    assert ds.extract_all_especies("limpa vidro com neon?", KNOWN) == ["cascudo", "neon"]
    assert ds.extract_all_especies("cardinal tetra com betta?", KNOWN) == ["tetacardi", "betta"]
    assert ds.extract_all_especies("tubarão vermelho com plati?", KNOWN) == ["labeo", "plati"]


def test_extract_params():
    p = ds.extract_params("posso colocar betta com coridora em 60L? pH 7.0")
    assert p["volume_l"] == 60
    assert p["ph"] == 7.0


def test_extract_params_turbidity():
    p = ds.extract_params("turbidez 25 NTU")
    assert p["turbidity"] == 25


def test_extract_params_temp_standalone():
    p = ds.extract_params("26°C")
    assert p["temp"] == 26


def test_extract_params_invalid_ignored():
    p = ds.extract_params("pH 99 em 999999L")
    assert "ph" not in p and "volume_l" not in p


def test_detect_intents_multi():
    intents = ds.detect_intents("pH ideal para betta em 60L?")
    assert "ph" in intents
    assert "volume" in intents


def test_detect_intents_ciclagem():
    intents = ds.detect_intents("como ciclar o aquário?")
    assert "ciclagem" in intents


def test_detect_intents_doenca():
    intents = ds.detect_intents("peixe com pontos brancos")
    assert "doenca" in intents


def test_is_aquarismo():
    assert ds.is_aquarismo("pH ideal para betta?")
    assert ds.is_aquarismo("como ciclar o aquário?")
    assert not ds.is_aquarismo("qual a capital do Brasil?")


def test_is_out_of_scope():
    assert ds.is_out_of_scope("qual receita de bolo?")
    assert ds.is_out_of_scope("qual a capital do Brasil?")
    assert not ds.is_out_of_scope("pH ideal para betta?")


def test_merge_inherit_and_switch():
    s = ds.merge_state(ds.new_state(), ds.extract_turn("pH ideal para betta?", KNOWN))
    assert s["especie"] == "betta"
    s2 = ds.merge_state(s, ds.extract_turn("e para neon?", KNOWN))
    assert s2["especie"] == "neon"
    s3 = ds.merge_state(s2, ds.extract_turn("e ele come o quê?", KNOWN))
    assert s3["especie"] == "neon"
    s4 = ds.merge_state(s, ds.extract_turn("e em 60L?", KNOWN))
    assert s4["especie"] == "betta" and s4["volume_l"] == 60


def test_merge_clears_companheiros_on_switch():
    s = ds.merge_state(ds.new_state(), ds.extract_turn("posso colocar betta com coridora?", KNOWN))
    assert "coridora" in s["companheiros"]
    s2 = ds.merge_state(s, ds.extract_turn("e para neon?", KNOWN))
    assert s2["especie"] == "neon"
    assert s2["companheiros"] == []


def test_followup():
    s = ds.new_state()
    assert ds.followup_for({**s, "last_intent": "compat"}, ["compat"]) is not None
    assert ds.followup_for({**s, "especie": "betta", "last_intent": "volume"}, ["volume"]) is None


def test_canonical_especie_alias():
    assert ds.canonical_especie("peixe dourado") == "kingui"
    assert ds.canonical_especie("beta") == "betta"
    assert ds.canonical_especie("tubarão") == "labeo"
    assert ds.canonical_especie("cardinal") == "tetacardi"
