# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read these first. They are authoritative; CLAUDE.md only adds Claude-specific commands and gotchas.

@AGENTS.md

Per-directory `AGENTS.md` files (`backend/`, `frontend/`, `scripts/`) carry module-specific detail and are loaded when working in those directories.

## Layout

Monorepo packaged as one Docker container: FastAPI (`backend/`) serves the API under `/api/*` and the statically exported Next.js frontend (`frontend/`) at `/`. One origin, port 8000.

## Commands

Backend (run from `backend/`, uses `uv`):
- `uv sync` — install deps
- `uv run pytest` — tests (`pythonpath = ["."]` is set in pyproject.toml)
- `uv run uvicorn app.main:app --reload` — dev server (port 8000)

Frontend (run from `frontend/`, uses npm):
- `npm run dev` (port 3000), `npm run build` (static export to `out/`)
- `npm run test:unit` (Vitest), `npm run test:e2e` (Playwright), `npm run test:all`

Whole app (repo root): `scripts/start.bat` builds and launches via `docker compose`; `scripts/stop.bat` stops it.

## Gotchas

- E2E tests require `uv` on PATH: Playwright's `webServer` builds the frontend and serves it through uvicorn against the real backend at `http://127.0.0.1:8000`, not `next start`.
- Playwright runs serial (`workers: 1`) on purpose: all tests share the single user's one board row, so concurrent writes race. The `login` helper resets the board to seed for determinism.
- AI chat calls (`POST /api/boards/{id}/chat`) take 20-50s (the model reads and returns the whole board each call). E2E mocks `**/api/boards/*/chat`.
- Keep `backend/app/seed.py` in sync with `frontend/src/lib/kanban.ts`: `DEFAULT_BOARD` mirrors `initialData`, and `new_board_data()` mirrors `emptyBoard()`. `test_seed_parity.py` checks the first.
- `OPENROUTER_API_KEY` in `.env` is required for the AI assistant (model `openai/gpt-oss-120b` via OpenRouter).
- Auth: self-service registration plus a seeded default user `user` / `password`. Passwords are PBKDF2 hashed (`app/security.py`); the session cookie carries `user_id`.
- The schema migrates forward on startup (`db._migrate`); the old one-board-per-user DB is rebuilt into the one-to-many shape automatically.
- E2E uses an isolated database (`DB_PATH=backend/data/e2e.sqlite3`, set in `e2e-server.mjs`); the `login` helper trims each run to one seeded board.

## Frontend specifics

- Path alias `@/* -> ./src/*` (mirrored in `vitest.config.ts`).
- TypeScript `strict: true`, `moduleResolution: "bundler"`.
