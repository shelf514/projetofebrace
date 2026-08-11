from datetime import datetime, timedelta, timezone


def test_post_reading_success(client, auth_headers, valid_payload):
    response = client.post("/api/readings", json=valid_payload, headers=auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["device_id"] == "AQUASENSE-TEST"
    assert body["temperature"] == 25.7
    assert body["turbidity"] == 12.4
    assert body["tds"] == 238.0
    assert body["anomaly"] is False
    assert body["prediction"] is None or isinstance(body["prediction"], str)


def test_post_reading_without_api_key(client, valid_payload):
    response = client.post("/api/readings", json=valid_payload)
    assert response.status_code == 401


def test_post_reading_with_wrong_api_key(client, valid_payload):
    response = client.post("/api/readings", json=valid_payload, headers={"X-API-Key": "errada"})
    assert response.status_code == 401


def test_post_reading_rejects_nan(client, auth_headers, valid_payload):
    payload = (
        '{"device_id":"AQUASENSE-TEST","temperature":NaN,"turbidity":12.4,'
        '"tds":238.0,"timestamp":"2026-08-09T20:00:00Z"}'
    )
    response = client.post(
        "/api/readings",
        content=payload,
        headers={**auth_headers, "Content-Type": "application/json"},
    )
    assert response.status_code == 422


def test_post_reading_rejects_negative_turbidity(client, auth_headers, valid_payload):
    payload = {**valid_payload, "turbidity": -1.0}
    response = client.post("/api/readings", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_post_reading_rejects_absurd_values(client, auth_headers, valid_payload):
    payload = {**valid_payload, "temperature": 99999.0}
    response = client.post("/api/readings", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_post_reading_rejects_invalid_timestamp(client, auth_headers, valid_payload):
    payload = {**valid_payload, "timestamp": "2026-99-99T20:00:00Z"}
    response = client.post("/api/readings", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_post_reading_accepts_out_of_soft_bounds_as_anomaly(client, auth_headers, valid_payload):
    payload = {**valid_payload, "temperature": 60.0}
    response = client.post("/api/readings", json=payload, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["anomaly"] is True


def test_get_readings_empty(client):
    response = client.get("/api/readings")
    assert response.status_code == 200
    assert response.json() == []


def test_get_readings_with_data(client, auth_headers, valid_payload):
    client.post("/api/readings", json=valid_payload, headers=auth_headers)
    response = client.get("/api/readings")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_latest_reading(client, auth_headers, valid_payload):
    client.post("/api/readings", json=valid_payload, headers=auth_headers)
    response = client.get("/api/readings/latest")
    assert response.status_code == 200
    assert response.json()["device_id"] == "AQUASENSE-TEST"


def test_get_latest_reading_404_when_empty(client):
    response = client.get("/api/readings/latest")
    assert response.status_code == 404


def test_history_with_period_filter(client, auth_headers, valid_payload):
    recent_payload = {
        **valid_payload,
        "timestamp": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
    }
    client.post("/api/readings", json=recent_payload, headers=auth_headers)
    start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = client.get("/api/readings/history", params={"start": start, "end": end})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_history_returns_empty_outside_range(client, auth_headers, valid_payload):
    client.post("/api/readings", json=valid_payload, headers=auth_headers)
    start = "2020-01-01T00:00:00Z"
    end = "2020-01-02T00:00:00Z"
    response = client.get("/api/readings/history", params={"start": start, "end": end})
    assert response.status_code == 200
    assert response.json() == []


def test_stats_endpoint(client, auth_headers, valid_payload):
    client.post("/api/readings", json=valid_payload, headers=auth_headers)
    response = client.get("/api/readings/stats")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert "temperature" in body
    assert "min" in body["temperature"]


def test_devices_created_on_post(client, auth_headers, valid_payload):
    client.post("/api/readings", json=valid_payload, headers=auth_headers)
    response = client.get("/api/devices")
    assert response.status_code == 200
    assert any(d["id"] == "AQUASENSE-TEST" for d in response.json())


def test_device_detail(client, auth_headers, valid_payload):
    client.post("/api/readings", json=valid_payload, headers=auth_headers)
    response = client.get("/api/devices/AQUASENSE-TEST")
    assert response.status_code == 200
    assert response.json()["id"] == "AQUASENSE-TEST"


def test_device_detail_404(client):
    response = client.get("/api/devices/NAO-EXISTE")
    assert response.status_code == 404
