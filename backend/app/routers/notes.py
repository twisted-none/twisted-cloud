from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Folder, Note, NoteVersion, User
from ..schemas import NoteIn, NoteOut, NoteVersionOut
from ..security import require_user
from ..trash_service import soft_delete_note

router = APIRouter(prefix="/notes", tags=["notes"])


def ensure_folder(db: Session, user: User, folder_id: int | None) -> None:
    if folder_id is None:
        return
    exists = db.query(Folder.id).filter(Folder.id == folder_id, Folder.owner_id == user.id, Folder.deleted_at.is_(None)).first()
    if exists is None:
        raise HTTPException(404, "Folder not found")


@router.get("", response_model=list[NoteOut])
def list_notes(folder_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(require_user)) -> list[Note]:
    query = db.query(Note).filter(Note.owner_id == user.id, Note.deleted_at.is_(None))
    if folder_id is not None:
        query = query.filter(Note.folder_id == folder_id)
    return query.order_by(Note.updated_at.desc()).all()


@router.post("", response_model=NoteOut)
def create_note(payload: NoteIn, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Note:
    ensure_folder(db, user, payload.folder_id)
    note = Note(**payload.model_dump(), owner_id=user.id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteOut)
def update_note(note_id: int, payload: NoteIn, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Note:
    ensure_folder(db, user, payload.folder_id)
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_(None)).first()
    if note is None:
        raise HTTPException(404, "Note not found")
    if note.title != payload.title or note.content != payload.content:
        db.add(NoteVersion(note_id=note.id, title=note.title, content=note.content))
    for key, value in payload.model_dump().items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{note_id}/versions", response_model=list[NoteVersionOut])
def list_versions(note_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> list[NoteVersion]:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_(None)).first()
    if note is None:
        raise HTTPException(404, "Note not found")
    return db.query(NoteVersion).filter(NoteVersion.note_id == note_id).order_by(NoteVersion.created_at.desc()).all()


@router.post("/{note_id}/versions/{version_id}/restore", response_model=NoteOut)
def restore_version(note_id: int, version_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Note:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_(None)).first()
    version = db.query(NoteVersion).filter(NoteVersion.id == version_id, NoteVersion.note_id == note_id).first()
    if note is None or version is None:
        raise HTTPException(404, "Version not found")
    db.add(NoteVersion(note_id=note.id, title=note.title, content=note.content))
    note.title = version.title
    note.content = version.content
    db.commit()
    db.refresh(note)
    return note


@router.get("/{note_id}/export")
def export_note(note_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Response:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_(None)).first()
    if note is None:
        raise HTTPException(404, "Note not found")
    filename = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in note.title).strip("_") or "note"
    return Response(
        content=note.content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
    )


@router.delete("/{note_id}", status_code=204)
def delete_note(note_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_(None)).first()
    if note is None:
        raise HTTPException(404, "Note not found")
    soft_delete_note(note)
    db.commit()
