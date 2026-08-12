import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Note, PublicShare, User
from ..schemas import PublicNoteOut, PublicShareOut
from ..security import require_user

router = APIRouter(prefix="/shares", tags=["shares"])
public_router = APIRouter(prefix="/public/shares", tags=["public-shares"])


@router.post("/notes/{note_id}", response_model=PublicShareOut)
def create_share(note_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_user)) -> PublicShareOut:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_(None)).first()
    if note is None:
        raise HTTPException(404, "Note not found")
    share = db.query(PublicShare).filter(PublicShare.note_id == note_id, PublicShare.owner_id == user.id).first()
    if share is None:
        share = PublicShare(note_id=note_id, owner_id=user.id, token=secrets.token_urlsafe(32))
        db.add(share)
        db.commit()
        db.refresh(share)
    return PublicShareOut(token=share.token, note_id=note_id, url=str(request.base_url).rstrip("/") + f"/share/{share.token}")


@router.delete("/notes/{note_id}", status_code=204)
def revoke_share(note_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    share = db.query(PublicShare).filter(PublicShare.note_id == note_id, PublicShare.owner_id == user.id).first()
    if share is not None:
        db.delete(share)
        db.commit()


@public_router.get("/{token}", response_model=PublicNoteOut)
def read_public_note(token: str, db: Session = Depends(get_db)) -> Note:
    share = db.query(PublicShare).filter(PublicShare.token == token).first()
    if share is None or share.note is None or share.note.deleted_at is not None:
        raise HTTPException(404, "Share not found")
    return share.note
