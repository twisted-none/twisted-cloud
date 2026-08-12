from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Folder, User
from ..schemas import FolderIn, FolderOut
from ..security import require_user
from ..trash_service import soft_delete_folder

router = APIRouter(prefix="/folders", tags=["folders"])


def ensure_parent(db: Session, user: User, parent_id: int | None, folder_id: int | None = None) -> None:
    if parent_id is None:
        return
    if parent_id == folder_id:
        raise HTTPException(400, "Folder cannot be its own parent")
    parent = db.query(Folder).filter(Folder.id == parent_id, Folder.owner_id == user.id, Folder.deleted_at.is_(None)).first()
    if parent is None:
        raise HTTPException(404, "Parent folder not found")
    while parent is not None:
        if parent.id == folder_id:
            raise HTTPException(400, "Folder cannot be moved inside itself")
        parent = db.query(Folder).filter(Folder.id == parent.parent_id, Folder.owner_id == user.id, Folder.deleted_at.is_(None)).first() if parent.parent_id else None


@router.get("", response_model=list[FolderOut])
def list_folders(db: Session = Depends(get_db), user: User = Depends(require_user)) -> list[Folder]:
    return db.query(Folder).filter(Folder.owner_id == user.id, Folder.deleted_at.is_(None)).order_by(Folder.name).all()


@router.post("", response_model=FolderOut)
def create_folder(payload: FolderIn, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Folder:
    ensure_parent(db, user, payload.parent_id)
    folder = Folder(**payload.model_dump(), owner_id=user.id)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.put("/{folder_id}", response_model=FolderOut)
def update_folder(folder_id: int, payload: FolderIn, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Folder:
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.owner_id == user.id, Folder.deleted_at.is_(None)).first()
    if folder is None:
        raise HTTPException(404, "Folder not found")
    ensure_parent(db, user, payload.parent_id, folder_id)
    folder.name = payload.name
    folder.parent_id = payload.parent_id
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{folder_id}", status_code=204)
def delete_folder(folder_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.owner_id == user.id, Folder.deleted_at.is_(None)).first()
    if folder is None:
        raise HTTPException(404, "Folder not found")
    soft_delete_folder(db, user, folder)
    db.commit()
