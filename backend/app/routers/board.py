from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.dependencies import require_user_id
from app.schemas import Board, BoardCreate, BoardDetail, BoardMeta, BoardRename

router = APIRouter(prefix="/api/boards", tags=["boards"])


@router.get("")
def list_boards(user_id: int = Depends(require_user_id)) -> list[BoardMeta]:
    return db.list_boards(user_id)


@router.post("", status_code=201)
def create_board(body: BoardCreate, user_id: int = Depends(require_user_id)) -> BoardMeta:
    return db.create_board(user_id, body.name)


@router.get("/{board_id}")
def read_board(board_id: int, user_id: int = Depends(require_user_id)) -> BoardDetail:
    board = db.get_board(board_id, user_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@router.put("/{board_id}")
def update_board(
    board_id: int, board: Board, user_id: int = Depends(require_user_id)
) -> Board:
    if not db.save_board(board_id, user_id, board.model_dump()):
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@router.patch("/{board_id}")
def patch_board(
    board_id: int, body: BoardRename, user_id: int = Depends(require_user_id)
) -> BoardMeta:
    meta = db.rename_board(board_id, user_id, body.name)
    if meta is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return meta


@router.delete("/{board_id}", status_code=204)
def remove_board(board_id: int, user_id: int = Depends(require_user_id)) -> None:
    if not db.delete_board(board_id, user_id):
        raise HTTPException(status_code=404, detail="Board not found")
