import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app import config
from app.security import hash_password
from app.seed import DEFAULT_BOARD, new_board_data

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);
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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def _migrate(conn: sqlite3.Connection) -> None:
    user_cols = _columns(conn, "users")
    if "password_hash" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
    if "created_at" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")

    # The old boards table was one-per-user (UNIQUE user_id) with no name. Rebuild
    # it into the one-to-many shape, preserving each user's board as "My Board".
    board_cols = _columns(conn, "boards")
    if board_cols and "name" not in board_cols:
        now = _now()
        conn.executescript(
            """
            CREATE TABLE boards_new (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                data       TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            INSERT INTO boards_new (id, user_id, name, data, created_at, updated_at)
            SELECT id, user_id, 'My Board', data, ?, updated_at FROM boards
            """,
            (now,),
        )
        conn.executescript(
            "DROP TABLE boards; ALTER TABLE boards_new RENAME TO boards;"
            "CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);"
        )


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
        _ensure_default_user(conn)


def _insert_board(conn: sqlite3.Connection, user_id: int, name: str, data: dict) -> int:
    now = _now()
    cur = conn.execute(
        "INSERT INTO boards (user_id, name, data, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (user_id, name, json.dumps(data), now, now),
    )
    return cur.lastrowid


def _ensure_default_user(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        "SELECT id, password_hash FROM users WHERE username = ?", (config.USERNAME,)
    ).fetchone()
    if row is None:
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (config.USERNAME, hash_password(config.PASSWORD), _now()),
        )
        _insert_board(conn, cur.lastrowid, "My Board", DEFAULT_BOARD)
    elif not row["password_hash"]:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(config.PASSWORD), row["id"]),
        )


# --- users -------------------------------------------------------------------


def create_user(username: str, password_hash: str) -> int | None:
    """Create a user and seed their first board. Returns None if the username is
    taken."""
    with _connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                (username, password_hash, _now()),
            )
        except sqlite3.IntegrityError:
            return None
        _insert_board(conn, cur.lastrowid, "My Board", DEFAULT_BOARD)
        return cur.lastrowid


def get_user(username: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return dict(row) if row else None


# --- boards ------------------------------------------------------------------


def _board_meta(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_boards(user_id: int) -> list[dict]:
    """List the user's boards (metadata only). A user always has at least one
    board, seeded when the account is created."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM boards WHERE user_id = ? ORDER BY created_at, id",
            (user_id,),
        ).fetchall()
        return [_board_meta(row) for row in rows]


def create_board(user_id: int, name: str, data: dict | None = None) -> dict:
    with _connect() as conn:
        board_id = _insert_board(
            conn, user_id, name, data if data is not None else new_board_data()
        )
        row = conn.execute("SELECT * FROM boards WHERE id = ?", (board_id,)).fetchone()
        return _board_meta(row)


def get_board(board_id: int, user_id: int) -> dict | None:
    """Return the full board (metadata + data) if it belongs to the user."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if row is None:
            return None
        return {**_board_meta(row), "data": json.loads(row["data"])}


def save_board(board_id: int, user_id: int, data: dict) -> bool:
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE boards SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (json.dumps(data), _now(), board_id, user_id),
        )
        return cur.rowcount > 0


def rename_board(board_id: int, user_id: int, name: str) -> dict | None:
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE boards SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (name, _now(), board_id, user_id),
        )
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM boards WHERE id = ?", (board_id,)).fetchone()
        return _board_meta(row)


def delete_board(board_id: int, user_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute(
            "DELETE FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        )
        return cur.rowcount > 0
