"""Smoke tests for the triage API."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_food_match():
    resp = client.post("/api/triage", json={"message": "I have no food and I'm hungry"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected_category"] == "food"
    assert body["urgent_handoff"] is False
    assert len(body["matches"]) >= 1
    assert body["fallback"]


def test_crisis_triggers_handoff():
    resp = client.post("/api/triage", json={"message": "I am suicidal and need help"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["urgent_handoff"] is True
    assert body["matches"] == []
