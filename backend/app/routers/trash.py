from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import FolderOut, NoteOut, TrashItemOut
from ..security import require_user
from ..trash_service import hard_delete_folder, hard_delete_note, list_trash, restore_folder, restore_note, unlink_media

router = APIRouter(prefix="/trash", tags=["trash"])


@router.get("", response_model=list[TrashItemOut])
def read_trash(db: Session = Depends(get_db), user: User = Depends(require_user)) -> list[TrashItemOut]:
    return list_trash(db, user)


@router.post("/notes/{note_id}/restore", response_model=NoteOut)
def restore_deleted_note(note_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)):
    note = restore_note(db, user, note_id)
    if note is None:
        raise HTTPException(404, "Deleted note not found")
    db.commit()
    db.refresh(note)
    return note


@router.post("/folders/{folder_id}/restore", response_model=FolderOut)
def restore_deleted_folder(folder_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)):
    folder = restore_folder(db, user, folder_id)
    if folder is None:
        raise HTTPException(404, "Deleted folder not found")
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/notes/{note_id}", status_code=204)
def delete_note_forever(note_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    stored_names = hard_delete_note(db, user, note_id, deleted_only=True)
    if stored_names is None:
        raise HTTPException(404, "Note not found")
    db.commit()
    unlink_media(stored_names)


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder_forever(folder_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    stored_names = hard_delete_folder(db, user, folder_id, deleted_only=True)
    if stored_names is None:
        raise HTTPException(404, "Folder not found")
    db.commit()
    unlink_media(stored_names)


@router.delete("", status_code=204)
def empty_trash(db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    stored_names: list[str] = []
    for item in list_trash(db, user):
        if item.kind == "folder":
            stored_names.extend(hard_delete_folder(db, user, item.id, deleted_only=True) or [])
        else:
            stored_names.extend(hard_delete_note(db, user, item.id, deleted_only=True) or [])
    db.commit()
    unlink_media(stored_names)
