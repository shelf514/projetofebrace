"""Testes da deteccao de anomalia por dispositivo e do /api/predict."""

from datetime import datetime, timedelta, timezone

import numpy as np

from app.models.reading import Reading
from app.services.anomaly import AnomalyDetector


def _seed_history(db_session, device_id: str, turbidity_base: float, count: int = 60) -> None:
    now = datetime.now(timezone.utc)
    rng = np.random.default_rng(42)
    for i in range(count):
        db_session.add(
            Reading(
                device_id=device_id,
                timestamp=now - timedelta(minutes=i * 10),
                temperature=25.0 + rng.normal(0, 0.3),
                turbidity=turbidity_base + (i % 9) * 1.2 + rng.normal(0, 0.4),
                tds=260.0 + rng.normal(0, 8),
                anomaly=False,
            )
        )
    db_session.commit()


def test_anomaly_detector_isolates_devices(db_session):
    """Cada dispositivo tem seu proprio 'normal' - sem contaminacao cruzada."""
    detector = AnomalyDetector(retrain_every=1)
    _seed_history(db_session, "DEV-A", turbidity_base=5.0)
    _seed_history(db_session, "DEV-B", turbidity_base=400.0)

    assert detector.on_new_reading(db_session, "DEV-A", 25.0, 6.0, 260.0) is False
    assert detector.on_new_reading(db_session, "DEV-B", 25.0, 405.0, 260.0) is False

    # A mesma turbidez que e normal para o B e anomala para o A
    assert detector.on_new_reading(db_session, "DEV-A", 25.0, 420.0, 260.0) is True


def test_anomaly_detector_soft_bounds_without_history(db_session):
    detector = AnomalyDetector()
    assert detector.check(db_session, "DEV-NOVO", 25.0, 10.0, 260.0) is False
    assert detector.check(db_session, "DEV-NOVO", 60.0, 10.0, 260.0) is True


def test_anomaly_detector_check_does_not_retrain(db_session):
    detector = AnomalyDetector(retrain_every=1)
    _seed_history(db_session, "DEV-C", turbidity_base=10.0)

    assert detector.on_new_reading(db_session, "DEV-C", 25.0, 11.0, 260.0) is False
    assert detector._models["DEV-C"].model is not None

    # check() nao incrementa o contador nem re-treina
    before = detector._models["DEV-C"].since_last_train
    assert detector.check(db_session, "DEV-C", 25.0, 11.0, 260.0) is False
    assert detector._models["DEV-C"].since_last_train == before


def test_predict_accepts_device_id(client, monkeypatch, db_session):
    from app.services import anomaly as anomaly_module
    from app.services.ml_service import ml_service

    monkeypatch.setattr(
        anomaly_module.anomaly_detector,
        "_models",
        anomaly_module.AnomalyDetector()._models,
    )

    class FakeModel:
        def __init__(self) -> None:
            self.prediction = "boa"

        def predict(self, features):
            return [self.prediction]

        def predict_proba(self, features):
            return np.array([[0.9, 0.1]])

    monkeypatch.setattr(ml_service, "model", FakeModel())
    monkeypatch.setattr(ml_service, "metadata", {"labels": ["boa", "ruim"]})
    monkeypatch.setattr(ml_service, "scaler", None)

    response = client.post(
        "/api/predict",
        json={"temperature": 25.0, "turbidity": 10.0, "tds": 200.0, "device_id": "DEV-API"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["prediction"] == "boa"
    assert body["anomaly"] is False
    assert body["model_loaded"] is True
