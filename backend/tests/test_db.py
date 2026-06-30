import json
import sqlite3

import pytest

from app import db

OLD_SCHEMA = """
CREATE TABLE users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
);
CREATE TABLE boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

LEGACY_BOARD = {
    "columns": [{"id": "c1", "title": "Old", "cardIds": ["k1"]}],
    "cards": {"k1": {"id": "k1", "title": "Legacy", "details": "kept"}},
}


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.sqlite3"
    monkeypatch.setenv("DB_PATH", str(path))
    return path


def test_migrates_old_single_board_schema(db_path):
    conn = sqlite3.connect(db_path)
    conn.executescript(OLD_SCHEMA)
    conn.execute("INSERT INTO users (username) VALUES ('user')")
    conn.execute(
        "INSERT INTO boards (user_id, data, updated_at) VALUES (1, ?, '2020-01-01')",
        (json.dumps(LEGACY_BOARD),),
    )
    conn.commit()
    conn.close()

    db.init_db()

    # The legacy board is preserved and gains a name.
    boards = db.list_boards(1)
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
    assert db.get_board(boards[0]["id"], 1)["data"] == LEGACY_BOARD

    # The default user can authenticate after the password backfill.
    user = db.get_user("user")
    from app.security import verify_password

    assert verify_password("password", user["password_hash"])


def test_init_is_idempotent(db_path):
    db.init_db()
    db.init_db()
    assert db.get_user("user") is not None


def test_create_and_list_boards(db_path):
    db.init_db()
    uid = db.get_user("user")["id"]
    db.list_boards(uid)  # seeds first board
    db.create_board(uid, "Second")
    names = [b["name"] for b in db.list_boards(uid)]
    assert names == ["My Board", "Second"]
