import asyncio
import logging
from contextlib import suppress
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pathlib import Path

from .config import get_settings
from .database import engine
from .models import User
from .routers import auth, folders, goals, media, notes, search, shares, trash, vault
from .security import hash_password, verify_password
from .trash_service import purge_all_expired_trash

app = FastAPI(title="Twisted Vault", version="0.1.0")
settings = get_settings()
logger = logging.getLogger(__name__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Path(settings.media_root).mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_root), name="media")
trash_purge_task: asyncio.Task[None] | None = None


@app.on_event("startup")
def startup() -> None:
    with Session(engine) as db:
        user = db.query(User).filter(User.email == settings.admin_email).first()
        if user is None:
            db.add(User(email=settings.admin_email, password_hash=hash_password(settings.admin_password)))
            db.commit()
        elif not verify_password(settings.admin_password, user.password_hash):
            user.password_hash = hash_password(settings.admin_password)
            db.commit()


@app.on_event("startup")
async def start_trash_purger() -> None:
    global trash_purge_task
    trash_purge_task = asyncio.create_task(trash_purge_loop())


@app.on_event("shutdown")
async def stop_trash_purger() -> None:
    if trash_purge_task is None:
        return
    trash_purge_task.cancel()
    with suppress(asyncio.CancelledError):
        await trash_purge_task


async def trash_purge_loop() -> None:
    while True:
        try:
            with Session(engine) as db:
                purge_all_expired_trash(db)
        except Exception:
            logger.exception("Trash purge failed")
        await asyncio.sleep(settings.trash_purge_interval_seconds)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api")
app.include_router(folders.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(vault.router, prefix="/api")
app.include_router(shares.router, prefix="/api")
app.include_router(shares.public_router, prefix="/api")
app.include_router(trash.router, prefix="/api")
