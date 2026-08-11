def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert "model_loaded" in body
    assert "uptime_seconds" in body


from app.services.ml_service import ml_service


def test_ml_status_without_model(client, monkeypatch):
    monkeypatch.setattr(ml_service, "model", None)
    monkeypatch.setattr(ml_service, "metadata", None)
    response = client.get("/api/ml/status")
    assert response.status_code == 200
    assert response.json()["model_loaded"] is False


def test_predict_without_model_returns_503(client, monkeypatch):
    monkeypatch.setattr(ml_service, "model", None)
    monkeypatch.setattr(ml_service, "metadata", None)
    response = client.post(
        "/api/predict", json={"temperature": 25.0, "turbidity": 10.0, "tds": 200.0}
    )
    assert response.status_code == 503


def test_predict_rejects_absurd_values(client):
    response = client.post(
        "/api/predict", json={"temperature": 999999.0, "turbidity": 10.0, "tds": 200.0}
    )
    assert response.status_code == 422


def test_ml_train_requires_api_key(client):
    response = client.post("/api/ml/train", json={"dataset": "demo_mock.csv"})
    assert response.status_code == 401


def test_ml_train_dataset_not_found(client, auth_headers):
    response = client.post(
        "/api/ml/train", json={"dataset": "nao-existe.csv"}, headers=auth_headers
    )
    assert response.status_code == 404


def test_ml_datasets_listing(client):
    response = client.get("/api/ml/datasets")
    assert response.status_code == 200
    assert "datasets" in response.json()
