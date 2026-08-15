from fastapi.testclient import TestClient
from api.index import app

client = TestClient(app)

def test_health_returns_ok():
    r = client.get("/api/py/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
