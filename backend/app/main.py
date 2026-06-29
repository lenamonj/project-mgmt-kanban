from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app import config, db
from app.routers import auth, board, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Project Management Studio", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=config.SESSION_SECRET,
    https_only=config.HTTPS_ONLY,
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(board.router)
app.include_router(chat.router)

# Serve the statically exported frontend at /. Registered after the API routes
# so /api/* always takes precedence. html=True serves index.html for /.
app.mount("/", StaticFiles(directory=config.STATIC_DIR, html=True), name="frontend")
