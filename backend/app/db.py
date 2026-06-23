import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.seed import DEFAULT_BOARD

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def _db_path() -> Path:
    return Path(os.environ.get("DB_PATH", "data/app.sqlite3"))


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(SCHEMA)


def get_or_create_user(username: str) -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if row:
            return row["id"]
        cur = conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
        return cur.lastrowid


def get_board(user_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT data FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        return json.loads(row["data"]) if row else None


def save_board(user_id: int, data: dict) -> None:
    payload = json.dumps(data)
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO boards (user_id, data, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET data = excluded.data,
                                               updated_at = excluded.updated_at
            """,
            (user_id, payload, now),
        )


def get_or_create_board(user_id: int) -> dict:
    board = get_board(user_id)
    if board is None:
        save_board(user_id, DEFAULT_BOARD)
        board = DEFAULT_BOARD
    return board
