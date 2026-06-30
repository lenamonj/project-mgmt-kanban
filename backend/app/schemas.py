from typing import Literal

from pydantic import BaseModel, Field


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)


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


class BoardMeta(BaseModel):
    id: int
    name: str
    created_at: str
    updated_at: str


class BoardDetail(BoardMeta):
    data: Board


class BoardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class BoardRename(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    board_update: Board | None = None
