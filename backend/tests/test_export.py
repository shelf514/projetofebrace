import csv
import io
from datetime import datetime, timedelta, timezone


def test_export_csv_empty(client):
    response = client.get("/api/readings/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    rows = list(csv.reader(io.StringIO(response.text)))
    assert rows[0][0] == "timestamp"


def test_export_csv_with_readings(client, auth_headers, valid_payload):
    recent = {
        **valid_payload,
        "timestamp": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
    }
    client.post("/api/readings", json=recent, headers=auth_headers)
    response = client.get("/api/readings/export")
    rows = list(csv.reader(io.StringIO(response.text)))
    assert len(rows) == 2  # cabecalho + 1 leitura
    data_row = rows[1]
    assert data_row[1] == "AQUASENSE-TEST"
    assert float(data_row[2]) == 25.7  # temperature
    assert data_row[7] in {"0", "1"}   # anomaly


def test_export_csv_filtered_by_device(client, auth_headers, valid_payload):
    other = {**valid_payload, "device_id": "OUTRO-001"}
    client.post("/api/readings", json=valid_payload, headers=auth_headers)
    client.post("/api/readings", json=other, headers=auth_headers)
    response = client.get("/api/readings/export", params={"device_id": "AQUASENSE-TEST"})
    rows = list(csv.reader(io.StringIO(response.text)))
    assert len(rows) == 2
    assert rows[1][1] == "AQUASENSE-TEST"


def test_export_csv_has_download_header(client):
    response = client.get("/api/readings/export")
    assert "attachment" in response.headers["content-disposition"]
