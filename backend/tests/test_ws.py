def test_ws_receives_broadcast_of_new_reading(client, auth_headers, valid_payload):
    with client.websocket_connect("/ws/readings") as websocket:
        response = client.post("/api/readings", json=valid_payload, headers=auth_headers)
        assert response.status_code == 201
        message = websocket.receive_json()
        assert message["type"] == "reading"
        data = message["data"]
        assert data["device_id"] == "AQUASENSE-TEST"
        assert data["temperature"] == 25.7
        assert data["turbidity"] == 12.4
        assert data["tds"] == 238.0


def test_ws_accepts_connection_without_message(client):
    with client.websocket_connect("/ws/readings") as websocket:
        assert websocket is not None


def test_ws_receives_multiple_readings(client, auth_headers, valid_payload):
    with client.websocket_connect("/ws/readings") as websocket:
        for i in range(3):
            payload = {**valid_payload, "temperature": 20.0 + i}
            client.post("/api/readings", json=payload, headers=auth_headers)
            message = websocket.receive_json()
            assert message["data"]["temperature"] == 20.0 + i
