# Architecture

Project Management Studio is a single Docker container running a FastAPI backend that serves both the JSON API and the statically exported Next.js frontend.

## Components

- **Frontend** - Next.js (App Router) exported to static HTML/JS/CSS. Renders the login screen, the Kanban board, and the AI chat sidebar. Talks to the backend over same-origin `fetch`.
- **Backend** - FastAPI application. Exposes the API under `/api/*`, manages sessions, reads and writes the board in SQLite, calls the AI model, and serves the static frontend at `/`.
- **Database** - SQLite file, created on first run. See [DATABASE.md](DATABASE.md).
- **AI** - OpenRouter, accessed through the OpenAI SDK, using the `openai/gpt-oss-120b` model.

## Request flow

1. The browser loads `/`, served by FastAPI from the exported frontend.
2. `GET /api/me` determines whether a session exists; the UI shows the login screen or the board.
3. `POST /api/login` validates the credentials and sets a signed, httpOnly session cookie. `POST /api/logout` clears it.
4. `GET /api/board` returns the signed-in user's board; `PUT /api/board` saves it. Board edits in the UI persist automatically.
5. `POST /api/chat` sends the current board, the user's message, and the conversation history to the model. The response contains a reply and, optionally, an updated board, which is saved and reflected in the UI.

All `/api/*` routes except login and health require a valid session.

## API

| Method | Path           | Description                                   |
| ------ | -------------- | --------------------------------------------- |
| GET    | `/api/health`  | Health check                                  |
| POST   | `/api/login`   | Validate credentials, set session cookie      |
| POST   | `/api/logout`  | Clear the session                             |
| GET    | `/api/me`      | Current user, or 401                          |
| GET    | `/api/board`   | The user's board                              |
| PUT    | `/api/board`   | Replace the user's board                      |
| POST   | `/api/chat`    | Assistant reply, with an optional board update |

## Board model

The board is one JSON document: ordered `columns`, each with an ordered list of card ids, and a `cards` map keyed by id. The same shape is used in the frontend (`BoardData`), the API (Pydantic `Board`), and storage (`boards.data`).

## AI board updates

The chat endpoint asks the model to return a JSON object with a reply and an optional complete board. The response is validated against the board model before being saved. Because the board's `cards` map has arbitrary keys, the result is validated against the shape rather than constrained by a strict response schema.

## Build and packaging

A multi-stage Docker build compiles the frontend to a static export and copies it into the backend image, which FastAPI serves at `/`. The Python environment is managed with `uv`. The board database is stored on a named Docker volume so it survives container restarts.
