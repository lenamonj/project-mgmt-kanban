# Backend

FastAPI backend, managed with `uv`. Serves the static frontend at `/` and the API under `/api/*`. Packaged into the single Docker container defined at the repo root.

## Stack

- Python 3.13, FastAPI, uvicorn
- `uv` for dependency management (`pyproject.toml`, `uv.lock`); project is non-packaged (`[tool.uv] package = false`)

## Structure

- `app/main.py` - FastAPI app. Endpoints: `GET /api/health`; `POST /api/login` / `POST /api/logout` / `GET /api/me` (auth); `GET /api/board` / `PUT /api/board` (auth, Pydantic `Board` validation); `POST /api/chat` (auth, AI). Inits the DB on startup (lifespan). The `/` mount serves the static frontend (API routes registered before the mount so `/api/*` keeps precedence)
- `app/db.py` - stdlib `sqlite3` layer: idempotent schema, `get_or_create_user`, `get_board` / `save_board` (JSON `data` column, upsert on `user_id`), `get_or_create_board` (seeds default on first access)
- `app/seed.py` - `DEFAULT_BOARD`, mirroring `frontend/src/lib/kanban.ts` `initialData`
- `app/ai.py` - OpenRouter client via the OpenAI SDK (`base_url` OpenRouter, model `openai/gpt-oss-120b`). `chat(messages, response_format=None)` and `two_plus_two()` connectivity check. Loads repo-root `.env` for local runs
- `app/static/` - static site served at `/`. Holds a committed "frontend not built" placeholder for standalone runs; the Docker build overlays the real Next.js export (`frontend/out`) here. Generated assets are gitignored
- `tests/test_main.py` - pytest + FastAPI TestClient covering health, static HTML, the full auth flow, and board CRUD (auto-create, seeded default, persistence, validation, auth enforcement). An autouse fixture points `DB_PATH` at a temp file per test

## Auth

- Hardcoded MVP credentials `user` / `password` (constants in `main.py`)
- Session via Starlette `SessionMiddleware` (signed, httpOnly cookie). Secret from `SESSION_SECRET` env (dev default)
- `require_user` dependency reads `request.session["user"]` and raises 401 if absent; protects `/api/me`, `/api/board`, and `/api/chat`

## Config (env)

- `SESSION_SECRET` - session cookie signing key
- `STATIC_DIR` - overrides the served static dir (used by frontend e2e to point at `frontend/out`)
- `DB_PATH` - SQLite file path (default `data/app.sqlite3`). In Docker, set to `/app/data/app.sqlite3` and backed by the `pmdata` volume so data survives restarts
- `OPENROUTER_API_KEY` - OpenRouter key for AI calls (from `.env` locally, via `env_file` in Docker)

## Run

- Install deps: `uv sync` (from `backend/`)
- Tests: `uv run pytest`
- Dev server: `uv run uvicorn app.main:app --reload`
- Full container (from repo root): `scripts/start.sh` / `scripts/start.bat`, stop with `scripts/stop.sh` / `scripts/stop.bat`. App is exposed at <http://localhost:8000>

## AI chat

`POST /api/chat` ({message, history}) builds a system prompt embedding the current board JSON, calls the model in JSON-object response mode, validates the result into `ChatResponse` ({reply, board_update?}), and persists `board_update` when present. The board's `cards` map has arbitrary keys, so the response is validated against the `Board` shape rather than constrained by a strict json-schema.
