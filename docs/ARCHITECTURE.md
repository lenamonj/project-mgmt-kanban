# Architecture

Project Management Studio is a single Docker container running a FastAPI backend that serves both the JSON API and the statically exported Next.js frontend.

## Components

- **Frontend** - Next.js (App Router) exported to static HTML/JS/CSS. Renders the sign-in/registration screen, the workspace (board switcher across a user's boards), the Kanban board, and the AI chat sidebar. Talks to the backend over same-origin `fetch`.
- **Backend** - FastAPI application. Exposes the API under `/api/*`, manages sessions, reads and writes the board in SQLite, calls the AI model, and serves the static frontend at `/`.
- **Database** - SQLite file, created on first run. See [DATABASE.md](DATABASE.md).
- **AI** - OpenRouter, accessed through the OpenAI SDK, using the `openai/gpt-oss-120b` model.

## Request flow

1. The browser loads `/`, served by FastAPI from the exported frontend.
2. `GET /api/me` determines whether a session exists; the UI shows the auth screen or the workspace.
3. `POST /api/register` creates an account; `POST /api/login` validates credentials against the stored hash. Both set a signed, httpOnly session cookie carrying the user id. `POST /api/logout` clears it.
4. `GET /api/boards` lists the user's boards; the workspace opens the first and lets the user switch, create, rename, and delete boards.
5. `GET /api/boards/{id}` returns a board; `PUT /api/boards/{id}` saves its data. Board edits in the UI persist automatically.
6. `POST /api/boards/{id}/chat` sends that board, the user's message, and the conversation history to the model. The response contains a reply and, optionally, an updated board, which is saved and reflected in the UI.

All `/api/*` routes except register, login, and health require a valid session. Every board route enforces that the board belongs to the signed-in user (otherwise 404).

## API

| Method | Path                     | Description                                    |
| ------ | ------------------------ | ---------------------------------------------- |
| GET    | `/api/health`            | Health check                                   |
| POST   | `/api/register`          | Create an account, set session cookie          |
| POST   | `/api/login`             | Validate credentials, set session cookie       |
| POST   | `/api/logout`            | Clear the session                              |
| GET    | `/api/me`                | Current user, or 401                           |
| GET    | `/api/boards`            | List the user's boards (metadata)              |
| POST   | `/api/boards`            | Create a board                                 |
| GET    | `/api/boards/{id}`       | A board's metadata and data                    |
| PUT    | `/api/boards/{id}`       | Replace a board's data                         |
| PATCH  | `/api/boards/{id}`       | Rename a board                                 |
| DELETE | `/api/boards/{id}`       | Delete a board                                 |
| POST   | `/api/boards/{id}/chat`  | Assistant reply, with an optional board update |

## Board model

The board is one JSON document: ordered `columns`, each with an ordered list of card ids, and a `cards` map keyed by id. The same shape is used in the frontend (`BoardData`), the API (Pydantic `Board`), and storage (`boards.data`).

## AI board updates

The chat endpoint asks the model to return a JSON object with a reply and an optional complete board. The response is validated against the board model before being saved. Because the board's `cards` map has arbitrary keys, the result is validated against the shape rather than constrained by a strict response schema.

## Build and packaging

A multi-stage Docker build compiles the frontend to a static export and copies it into the backend image, which FastAPI serves at `/`. The Python environment is managed with `uv`. The board database is stored on a named Docker volume so it survives container restarts.
