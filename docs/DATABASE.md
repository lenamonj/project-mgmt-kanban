# Database

SQLite, accessed through Python's standard-library `sqlite3`. Each user's board is stored as a single JSON document, mirroring the `BoardData` shape used by the frontend so the same structure flows through client, API, and storage.

## Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data       TEXT NOT NULL,          -- JSON: BoardData
    updated_at TEXT NOT NULL           -- ISO 8601 timestamp
);
```

- `users` supports multiple accounts.
- `boards.user_id` is `UNIQUE`: one board per user.
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
- The user row is created on first access if absent.
- A default board is created for a user on first access if they have none.
- `GET /api/board` returns `data`; `PUT /api/board` replaces `data` and updates `updated_at`.

## Configuration

- `DB_PATH` sets the SQLite file location (default `data/app.sqlite3`). In Docker it is `/app/data/app.sqlite3`, backed by a named volume so data persists across restarts. SQLite files are gitignored.

## Authentication and storage

Authentication uses a single hardcoded credential pair checked in the backend; passwords are not stored in the database.
