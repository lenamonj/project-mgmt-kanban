# Database

SQLite, accessed through Python's standard-library `sqlite3`. Each board is stored as a single JSON document, mirroring the `BoardData` shape used by the frontend so the same structure flows through client, API, and storage.

## Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',  -- PBKDF2-HMAC-SHA256
    created_at    TEXT NOT NULL DEFAULT ''   -- ISO 8601 timestamp
);

CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    data       TEXT NOT NULL,          -- JSON: BoardData
    created_at TEXT NOT NULL,          -- ISO 8601 timestamp
    updated_at TEXT NOT NULL           -- ISO 8601 timestamp
);

CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);
```

- `users` supports multiple accounts, each with a salted password hash.
- `boards.user_id` is one-to-many: a user can own many boards. Deleting a user cascades to their boards.
- `boards.data` holds the board JSON described below.

## Board JSON shape (`boards.data`)

Matches `BoardData` in `frontend/src/lib/kanban.ts`:

```jsonc
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "..." }
  }
}
```

- `columns`: ordered array. Each has `id`, `title`, and an ordered `cardIds` list referencing keys in `cards`.
- `cards`: map keyed by card id; each card has `id`, `title`, `details`.
- Card order within a column is the order of `cardIds`; column order is the array order.

The backend validates this shape on write with Pydantic models (`Card` / `Column` / `Board`).

## Lifecycle

- The database file and tables are created on startup if missing (`CREATE TABLE IF NOT EXISTS`).
- On startup the schema is migrated forward: missing `users` columns are added, and an old one-board-per-user `boards` table is rebuilt into the one-to-many shape, preserving each board as `My Board`.
- The default user (`user`) is seeded on startup if absent, with its password hashed.
- Registering a user, or seeding the default user, creates that user's first board from `DEFAULT_BOARD`. Boards created later start from the empty template (`new_board_data`).
- `GET /api/boards/{id}` returns `name` plus `data`; `PUT /api/boards/{id}` replaces `data` and updates `updated_at`.

## Configuration

- `DB_PATH` sets the SQLite file location (default `data/app.sqlite3`). In Docker it is `/app/data/app.sqlite3`, backed by a named volume so data persists across restarts. SQLite files are gitignored.

## Authentication

Passwords are hashed with PBKDF2-HMAC-SHA256 (standard library, per-user random salt) and stored in `users.password_hash`. Login verifies the supplied password against the stored hash; the session cookie then carries the user id.
