import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Project Management Studio", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET", "dev-secret-change-me"),
)

# Static dir is overridable so local e2e can point at frontend/out directly.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent / "static"))

# Hardcoded MVP credentials.
USERNAME = "user"
PASSWORD = "password"


class Credentials(BaseModel):
    username: str
    password: str


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class Board(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    board_update: Board | None = None


SYSTEM_PROMPT = """\
You are a project management assistant inside a Kanban board app.
You can answer questions about the board and optionally modify it.

Respond with a single JSON object with this exact shape:
{"reply": string, "board_update": Board | null}

- "reply": a short message to show the user.
- "board_update": the COMPLETE updated board, or null if no change is needed.

The board has this shape:
{"columns": [{"id": string, "title": string, "cardIds": [string]}],
 "cards": {"<cardId>": {"id": string, "title": string, "details": string}}}

Rules:
- When changing the board, return the entire board, not a diff.
- Preserve existing ids. Every id in a column's cardIds must exist in cards, and
  every card in cards must be referenced by exactly one column.
- For new cards, invent a new unique id like "card-<short-random>".
- Only set board_update when the user asks to change the board.

The user's current board is:
"""


def build_chat_messages(board: dict, req: ChatRequest) -> list[dict]:
    system = {"role": "system", "content": SYSTEM_PROMPT + json.dumps(board)}
    history = [{"role": m.role, "content": m.content} for m in req.history]
    return [system, *history, {"role": "user", "content": req.message}]


def require_user(request: Request) -> str:
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(creds: Credentials, request: Request):
    if creds.username != USERNAME or creds.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    request.session["user"] = creds.username
    return {"username": creds.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(user: str = Depends(require_user)):
    return {"username": user}


@app.get("/api/board")
def read_board(user: str = Depends(require_user)) -> Board:
    user_id = db.get_or_create_user(user)
    return db.get_or_create_board(user_id)


@app.put("/api/board")
def write_board(board: Board, user: str = Depends(require_user)) -> Board:
    user_id = db.get_or_create_user(user)
    db.save_board(user_id, board.model_dump())
    return board


@app.post("/api/chat")
def chat(req: ChatRequest, user: str = Depends(require_user)) -> ChatResponse:
    user_id = db.get_or_create_user(user)
    board = db.get_or_create_board(user_id)
    raw = ai.chat(
        build_chat_messages(board, req), response_format={"type": "json_object"}
    )
    try:
        result = ChatResponse.model_validate_json(raw)
    except ValidationError:
        raise HTTPException(status_code=502, detail="AI returned an invalid response")
    if result.board_update is not None:
        db.save_board(user_id, result.board_update.model_dump())
    return result


# Serve the statically exported frontend at /. Registered after the API routes
# so /api/* always takes precedence. html=True serves index.html for /.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
