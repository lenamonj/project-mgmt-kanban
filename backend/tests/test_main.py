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


def auth_client(username="user", password="password") -> TestClient:
    c = TestClient(app)
    c.post("/api/login", json={"username": username, "password": password})
    return c


def first_board_id(c: TestClient) -> int:
    return c.get("/api/boards").json()[0]["id"]


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_index_serves_html():
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


# --- auth --------------------------------------------------------------------


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
    c = auth_client()
    assert c.get("/api/me").status_code == 200
    assert c.post("/api/logout").status_code == 200
    assert c.get("/api/me").status_code == 401


def test_register_creates_user_and_session():
    c = TestClient(app)
    r = c.post("/api/register", json={"username": "alice", "password": "s3cret"})
    assert r.status_code == 201
    assert r.json() == {"username": "alice"}
    assert c.get("/api/me").json() == {"username": "alice"}


def test_register_duplicate_is_conflict():
    c = TestClient(app)
    c.post("/api/register", json={"username": "bob", "password": "pw"})
    r = TestClient(app).post("/api/register", json={"username": "bob", "password": "pw"})
    assert r.status_code == 409


def test_registered_user_can_login():
    TestClient(app).post("/api/register", json={"username": "carol", "password": "pw123"})
    r = TestClient(app).post("/api/login", json={"username": "carol", "password": "pw123"})
    assert r.status_code == 200
    assert auth_client("carol", "pw123").get("/api/me").json() == {"username": "carol"}


def test_register_rejects_blank_username():
    r = TestClient(app).post("/api/register", json={"username": "", "password": "pw"})
    assert r.status_code == 422


# --- boards ------------------------------------------------------------------


def test_boards_require_auth():
    assert TestClient(app).get("/api/boards").status_code == 401
    assert TestClient(app).post("/api/boards", json={"name": "X"}).status_code == 401


def test_first_board_seeded_on_list():
    c = auth_client()
    boards = c.get("/api/boards").json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
    detail = c.get(f"/api/boards/{boards[0]['id']}").json()
    assert detail["data"] == DEFAULT_BOARD


def test_create_board_starts_empty():
    c = auth_client()
    r = c.post("/api/boards", json={"name": "Launch plan"})
    assert r.status_code == 201
    meta = r.json()
    assert meta["name"] == "Launch plan"
    detail = c.get(f"/api/boards/{meta['id']}").json()
    assert detail["data"]["cards"] == {}
    assert len(detail["data"]["columns"]) == 3
    assert len(c.get("/api/boards").json()) == 2


def test_update_board_persists():
    c = auth_client()
    bid = first_board_id(c)
    assert c.put(f"/api/boards/{bid}", json=SMALL_BOARD).status_code == 200
    assert auth_client().get(f"/api/boards/{bid}").json()["data"] == SMALL_BOARD


def test_rename_board():
    c = auth_client()
    bid = first_board_id(c)
    r = c.patch(f"/api/boards/{bid}", json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


def test_delete_board():
    c = auth_client()
    new_id = c.post("/api/boards", json={"name": "Temp"}).json()["id"]
    assert c.delete(f"/api/boards/{new_id}").status_code == 204
    assert c.get(f"/api/boards/{new_id}").status_code == 404


def test_board_rejects_invalid_payload():
    c = auth_client()
    bid = first_board_id(c)
    assert c.put(f"/api/boards/{bid}", json={"columns": "nope"}).status_code == 422


def test_users_cannot_access_each_others_boards():
    a = TestClient(app)
    a.post("/api/register", json={"username": "ann", "password": "pw"})
    a_board = a.get("/api/boards").json()[0]["id"]

    b = TestClient(app)
    b.post("/api/register", json={"username": "ben", "password": "pw"})

    assert b.get(f"/api/boards/{a_board}").status_code == 404
    assert b.put(f"/api/boards/{a_board}", json=SMALL_BOARD).status_code == 404
    assert b.delete(f"/api/boards/{a_board}").status_code == 404
    assert b.patch(f"/api/boards/{a_board}", json={"name": "hax"}).status_code == 404
    # A's board is untouched.
    assert a.get(f"/api/boards/{a_board}").json()["data"] == DEFAULT_BOARD


def test_get_missing_board_is_404():
    assert auth_client().get("/api/boards/99999").status_code == 404


# --- chat --------------------------------------------------------------------


def test_chat_requires_auth():
    r = TestClient(app).post("/api/boards/1/chat", json={"message": "hi"})
    assert r.status_code == 401


def test_chat_reply_only_leaves_board_unchanged(monkeypatch):
    monkeypatch.setattr(
        ai, "chat", lambda *a, **k: json.dumps({"reply": "Hello", "board_update": None})
    )
    c = auth_client()
    bid = first_board_id(c)
    r = c.post(f"/api/boards/{bid}/chat", json={"message": "hi"})
    assert r.status_code == 200
    assert r.json() == {"reply": "Hello", "board_update": None}
    assert c.get(f"/api/boards/{bid}").json()["data"] == DEFAULT_BOARD


def test_chat_applies_board_update(monkeypatch):
    monkeypatch.setattr(
        ai,
        "chat",
        lambda *a, **k: json.dumps({"reply": "Done", "board_update": SMALL_BOARD}),
    )
    c = auth_client()
    bid = first_board_id(c)
    r = c.post(f"/api/boards/{bid}/chat", json={"message": "replace the board"})
    assert r.status_code == 200
    assert r.json()["board_update"] == SMALL_BOARD
    assert c.get(f"/api/boards/{bid}").json()["data"] == SMALL_BOARD


def test_chat_on_missing_board_is_404(monkeypatch):
    monkeypatch.setattr(
        ai, "chat", lambda *a, **k: json.dumps({"reply": "x", "board_update": None})
    )
    assert auth_client().post("/api/boards/99999/chat", json={"message": "hi"}).status_code == 404


def test_chat_invalid_response_is_502(monkeypatch):
    monkeypatch.setattr(ai, "chat", lambda *a, **k: "not json at all")
    c = auth_client()
    bid = first_board_id(c)
    assert c.post(f"/api/boards/{bid}/chat", json={"message": "hi"}).status_code == 502


def test_chat_upstream_failure_is_502(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(ai, "chat", boom)
    c = auth_client()
    bid = first_board_id(c)
    assert c.post(f"/api/boards/{bid}/chat", json={"message": "hi"}).status_code == 502


def test_chat_rejects_invalid_history_role():
    c = auth_client()
    bid = first_board_id(c)
    r = c.post(
        f"/api/boards/{bid}/chat",
        json={"message": "hi", "history": [{"role": "system", "content": "x"}]},
    )
    assert r.status_code == 422
