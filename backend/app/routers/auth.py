from fastapi import APIRouter, Depends, HTTPException, Request

from app import db
from app.dependencies import require_user_id
from app.schemas import Credentials
from app.security import hash_password, verify_password

router = APIRouter(prefix="/api", tags=["auth"])


def _set_session(request: Request, user_id: int, username: str) -> None:
    request.session["user_id"] = user_id
    request.session["username"] = username


@router.post("/register", status_code=201)
def register(creds: Credentials, request: Request):
    user_id = db.create_user(creds.username, hash_password(creds.password))
    if user_id is None:
        raise HTTPException(status_code=409, detail="Username already taken")
    _set_session(request, user_id, creds.username)
    return {"username": creds.username}


@router.post("/login")
def login(creds: Credentials, request: Request):
    user = db.get_user(creds.username)
    if user is None or not verify_password(creds.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_session(request, user["id"], user["username"])
    return {"username": user["username"]}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@router.get("/me")
def me(request: Request, user_id: int = Depends(require_user_id)):
    return {"username": request.session.get("username")}
