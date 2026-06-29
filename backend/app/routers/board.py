from fastapi import APIRouter, Depends

from app import db
from app.dependencies import require_user
from app.schemas import Board

router = APIRouter(prefix="/api", tags=["board"])


@router.get("/board")
def read_board(user: str = Depends(require_user)) -> Board:
    user_id = db.get_or_create_user(user)
    return db.get_or_create_board(user_id)


@router.put("/board")
def write_board(board: Board, user: str = Depends(require_user)) -> Board:
    user_id = db.get_or_create_user(user)
    db.save_board(user_id, board.model_dump())
    return board
