from fastapi.testclient import TestClient
from backend.main import app, DB

def setup_function():
    if DB.exists(): DB.unlink()

def test_rest_and_websocket_collaboration():
    with TestClient(app) as client:
        created=client.post('/api/sessions'); assert created.status_code == 201; session=created.json()['id']
        assert client.get(f'/api/sessions/{session}').json()['language'] == 'python'
        with client.websocket_connect(f'/ws/sessions/{session}') as first, client.websocket_connect(f'/ws/sessions/{session}') as second:
            first.receive_json(); second.receive_json()
            first.send_json({'type':'update','code':'console.log(42)','language':'javascript'})
            assert second.receive_json()['code'] == 'console.log(42)'
        assert client.get(f'/api/sessions/{session}').json()['language'] == 'javascript'
