from fastapi import APIRouter, Depends, HTTPException, Request

from app import config
from app.dependencies import require_user
from app.schemas import Credentials

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/login")
def login(creds: Credentials, request: Request):
    if creds.username != config.USERNAME or creds.password != config.PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    request.session["user"] = creds.username
    return {"username": creds.username}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@router.get("/me")
def me(user: str = Depends(require_user)):
    return {"username": user}
