import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from app import ai, db
from app.dependencies import require_user
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["chat"])

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


@router.post("/chat")
def chat(req: ChatRequest, user: str = Depends(require_user)) -> ChatResponse:
    user_id = db.get_or_create_user(user)
    board = db.get_or_create_board(user_id)
    try:
        raw = ai.chat(
            build_chat_messages(board, req), response_format={"type": "json_object"}
        )
        result = ChatResponse.model_validate_json(raw)
    except ValidationError:
        raise HTTPException(status_code=502, detail="AI returned an invalid response")
    except Exception:
        raise HTTPException(status_code=502, detail="AI request failed")
    if result.board_update is not None:
        db.save_board(user_id, result.board_update.model_dump())
    return result
