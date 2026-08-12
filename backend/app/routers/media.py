from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Attachment, Note, User
from ..schemas import AttachmentOut
from ..security import require_user

router = APIRouter(prefix="/media", tags=["media"])
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}
MAX_BYTES = 8 * 1024 * 1024


def to_out(item: Attachment) -> AttachmentOut:
    return AttachmentOut(
        id=item.id,
        note_id=item.note_id,
        original_name=item.original_name,
        content_type=item.content_type,
        size=item.size,
        url=f"/media/{item.stored_name}",
        created_at=item.created_at,
    )


@router.post("", response_model=AttachmentOut)
async def upload_media(
    note_id: int | None = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> AttachmentOut:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only jpg, png, gif and webp images are supported")
    if note_id is not None and db.query(Note.id).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_(None)).first() is None:
        raise HTTPException(404, "Note not found")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image is too large")
    stored_name = f"{uuid4().hex}{ALLOWED_TYPES[file.content_type]}"
    root = Path(get_settings().media_root)
    root.mkdir(parents=True, exist_ok=True)
    (root / stored_name).write_bytes(data)
    item = Attachment(owner_id=user.id, note_id=note_id, original_name=file.filename or stored_name, stored_name=stored_name, content_type=file.content_type, size=len(data))
    db.add(item)
    db.commit()
    db.refresh(item)
    return to_out(item)


@router.get("", response_model=list[AttachmentOut])
def list_media(note_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(require_user)) -> list[AttachmentOut]:
    query = db.query(Attachment).filter(Attachment.owner_id == user.id)
    if note_id is not None:
        query = query.filter(Attachment.note_id == note_id)
    return [to_out(item) for item in query.order_by(Attachment.created_at.desc()).all()]


@router.delete("/{attachment_id}", status_code=204)
def delete_media(attachment_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    item = db.query(Attachment).filter(Attachment.id == attachment_id, Attachment.owner_id == user.id).first()
    if item is None:
        raise HTTPException(404, "Attachment not found")
    path = Path(get_settings().media_root) / item.stored_name
    db.delete(item)
    db.commit()
    if path.exists():
        path.unlink()
