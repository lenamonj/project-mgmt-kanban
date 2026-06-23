import json

import pytest
from fastapi.testclient import TestClient

from app import ai, db
from app.main import app
from app.seed import DEFAULT_BOARD

client = TestClient(app)

SMALL_BOARD = {
    "columns": [{"id": "col-a", "title": "A", "cardIds": ["x"]}],
    "cards": {"x": {"id": "x", "title": "Card X", "details": "d"}},
}


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.sqlite3"))
    db.init_db()
    yield


def auth_client() -> TestClient:
    c = TestClient(app)
    c.post("/api/login", json={"username": "user", "password": "password"})
    return c


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_index_serves_html():
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


def test_login_success_sets_session():
    c = TestClient(app)
    r = c.post("/api/login", json={"username": "user", "password": "password"})
    assert r.status_code == 200
    assert r.json() == {"username": "user"}
    assert "session" in r.cookies


def test_login_failure():
    c = TestClient(app)
    r = c.post("/api/login", json={"username": "user", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_session():
    c = TestClient(app)
    assert c.get("/api/me").status_code == 401
    c.post("/api/login", json={"username": "user", "password": "password"})
    r = c.get("/api/me")
    assert r.status_code == 200
    assert r.json() == {"username": "user"}


def test_logout_clears_session():
    c = TestClient(app)
    c.post("/api/login", json={"username": "user", "password": "password"})
    assert c.get("/api/me").status_code == 200
    assert c.post("/api/logout").status_code == 200
    assert c.get("/api/me").status_code == 401


def test_board_requires_auth():
    assert TestClient(app).get("/api/board").status_code == 401
    assert TestClient(app).put("/api/board", json=DEFAULT_BOARD).status_code == 401


def test_board_seeded_on_first_access():
    r = auth_client().get("/api/board")
    assert r.status_code == 200
    assert r.json() == DEFAULT_BOARD


def test_board_update_persists():
    c = auth_client()
    updated = {
        "columns": [{"id": "col-a", "title": "A", "cardIds": ["x"]}],
        "cards": {"x": {"id": "x", "title": "Card X", "details": "d"}},
    }
    assert c.put("/api/board", json=updated).status_code == 200
    # New client (new session) should read the persisted board.
    assert auth_client().get("/api/board").json() == updated


def test_board_rejects_invalid_payload():
    c = auth_client()
    assert c.put("/api/board", json={"columns": "nope"}).status_code == 422


def test_chat_requires_auth():
    r = TestClient(app).post("/api/chat", json={"message": "hi"})
    assert r.status_code == 401


def test_chat_reply_only_leaves_board_unchanged(monkeypatch):
    monkeypatch.setattr(
        ai, "chat", lambda *a, **k: json.dumps({"reply": "Hello", "board_update": None})
    )
    c = auth_client()
    r = c.post("/api/chat", json={"message": "hi"})
    assert r.status_code == 200
    assert r.json() == {"reply": "Hello", "board_update": None}
    assert c.get("/api/board").json() == DEFAULT_BOARD


def test_chat_applies_board_update(monkeypatch):
    monkeypatch.setattr(
        ai,
        "chat",
        lambda *a, **k: json.dumps({"reply": "Done", "board_update": SMALL_BOARD}),
    )
    c = auth_client()
    r = c.post("/api/chat", json={"message": "replace the board"})
    assert r.status_code == 200
    assert r.json()["board_update"] == SMALL_BOARD
    assert c.get("/api/board").json() == SMALL_BOARD


def test_chat_invalid_response_is_502(monkeypatch):
    monkeypatch.setattr(ai, "chat", lambda *a, **k: "not json at all")
    r = auth_client().post("/api/chat", json={"message": "hi"})
    assert r.status_code == 502
