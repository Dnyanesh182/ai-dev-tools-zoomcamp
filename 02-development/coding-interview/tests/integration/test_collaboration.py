from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import database
from backend import main


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch):
    """Keep integration checks from touching a developer's local PairPad data."""
    db_path = Path(__file__).with_name(".pairpad-test.db")
    if db_path.exists():
        db_path.unlink()

    monkeypatch.setattr(database, "SQLITE_DB", db_path)
    monkeypatch.setattr(database, "DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setattr(main, "DB", db_path)
    yield

    if db_path.exists():
        db_path.unlink()


def test_rest_and_websocket_collaboration():
    with TestClient(main.app) as client:
        assert client.get("/healthz").json() == {"status": "ok"}
        created = client.post("/api/sessions")
        assert created.status_code == 201
        session = created.json()["id"]
        assert client.get(f"/api/sessions/{session}").json()["language"] == "python"

        with client.websocket_connect(
            f"/ws/sessions/{session}"
        ) as first, client.websocket_connect(
            f"/ws/sessions/{session}"
        ) as second:
            first.receive_json()
            second.receive_json()
            first.send_json(
                {
                    "type": "update",
                    "code": "console.log(42)",
                    "language": "javascript",
                }
            )
            assert second.receive_json()["code"] == "console.log(42)"

        assert client.get(f"/api/sessions/{session}").json()["language"] == "javascript"


def test_webrtc_signal_broadcasts_between_clients():
    with TestClient(main.app) as client:
        created = client.post("/api/sessions")
        session = created.json()["id"]

        with client.websocket_connect(
            f"/ws/sessions/{session}"
        ) as first, client.websocket_connect(
            f"/ws/sessions/{session}"
        ) as second:
            first.receive_json()
            second.receive_json()
            first.send_json(
                {
                    "type": "webrtc-signal",
                    "peerId": "peer-a",
                    "signalType": "offer",
                    "offer": {"type": "offer", "sdp": "v=0"},
                }
            )
            message = second.receive_json()
            assert message["type"] == "webrtc-signal"
            assert message["signalType"] == "offer"
            assert message["peerId"] == "peer-a"

            first.send_json(
                {
                    "type": "webrtc-signal",
                    "peerId": "peer-a",
                    "signalType": "candidate",
                    "candidate": {"candidate": "candidate:test"},
                }
            )
            assert second.receive_json()["signalType"] == "candidate"


def test_local_frontend_origin_is_allowed():
    with TestClient(main.app) as client:
        response = client.post(
            "/api/sessions",
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.status_code == 201
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
