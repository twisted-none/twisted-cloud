from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from .config import get_settings
from .models import Attachment, Folder, Note, PublicShare, User
from .schemas import TrashItemOut

TRASH_RETENTION = timedelta(days=30)


def utc_now() -> datetime:
    return datetime.utcnow()


def expires_at(deleted_at: datetime) -> datetime:
    return deleted_at + TRASH_RETENTION


def descendant_folder_ids(db: Session, user: User, folder_id: int) -> list[int]:
    ids = [folder_id]
    frontier = [folder_id]
    while frontier:
        rows = db.query(Folder.id).filter(Folder.owner_id == user.id, Folder.parent_id.in_(frontier)).all()
        frontier = [row.id for row in rows if row.id not in ids]
        ids.extend(frontier)
    return ids


def soft_delete_note(note: Note) -> None:
    note.deleted_at = utc_now()


def soft_delete_folder(db: Session, user: User, folder: Folder) -> None:
    stamp = utc_now()
    folder_ids = descendant_folder_ids(db, user, folder.id)
    db.query(Folder).filter(Folder.owner_id == user.id, Folder.id.in_(folder_ids)).update(
        {Folder.deleted_at: stamp}, synchronize_session=False
    )
    db.query(Note).filter(Note.owner_id == user.id, Note.folder_id.in_(folder_ids)).update(
        {Note.deleted_at: stamp}, synchronize_session=False
    )


def list_trash(db: Session, user: User) -> list[TrashItemOut]:
    purge_expired_trash(db, user)
    folders = db.query(Folder).filter(Folder.owner_id == user.id, Folder.deleted_at.is_not(None)).all()
    folder_ids = {folder.id for folder in folders}
    root_folders = [folder for folder in folders if folder.parent_id not in folder_ids]
    notes = db.query(Note).filter(Note.owner_id == user.id, Note.deleted_at.is_not(None)).all()
    visible_notes = [note for note in notes if note.folder_id not in folder_ids]
    items = [
        TrashItemOut(kind="folder", id=f.id, title=f.name, parent_id=f.parent_id, deleted_at=f.deleted_at, expires_at=expires_at(f.deleted_at))
        for f in root_folders
        if f.deleted_at is not None
    ]
    items.extend(
        TrashItemOut(kind="note", id=n.id, title=n.title, parent_id=n.folder_id, deleted_at=n.deleted_at, expires_at=expires_at(n.deleted_at))
        for n in visible_notes
        if n.deleted_at is not None
    )
    return sorted(items, key=lambda item: item.deleted_at, reverse=True)


def restore_note(db: Session, user: User, note_id: int) -> Note | None:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id, Note.deleted_at.is_not(None)).first()
    if note is None:
        return None
    parent = db.query(Folder).filter(Folder.id == note.folder_id, Folder.owner_id == user.id).first() if note.folder_id else None
    if parent is not None and parent.deleted_at is not None:
        note.folder_id = None
    note.deleted_at = None
    return note


def restore_folder(db: Session, user: User, folder_id: int) -> Folder | None:
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.owner_id == user.id, Folder.deleted_at.is_not(None)).first()
    if folder is None:
        return None
    parent = db.query(Folder).filter(Folder.id == folder.parent_id, Folder.owner_id == user.id).first() if folder.parent_id else None
    if parent is not None and parent.deleted_at is not None:
        folder.parent_id = None
    folder_ids = descendant_folder_ids(db, user, folder.id)
    db.query(Folder).filter(Folder.owner_id == user.id, Folder.id.in_(folder_ids)).update({Folder.deleted_at: None}, synchronize_session=False)
    db.query(Note).filter(Note.owner_id == user.id, Note.folder_id.in_(folder_ids)).update({Note.deleted_at: None}, synchronize_session=False)
    return folder


def purge_expired_trash(db: Session, user: User) -> None:
    cutoff = utc_now() - TRASH_RETENTION
    folders = db.query(Folder).filter(Folder.owner_id == user.id, Folder.deleted_at <= cutoff).all()
    deleted_folder_ids = {folder.id for folder in db.query(Folder.id).filter(Folder.owner_id == user.id, Folder.deleted_at.is_not(None)).all()}
    stored_names: list[str] = []
    for folder in folders:
        if folder.parent_id not in deleted_folder_ids:
            stored_names.extend(hard_delete_folder(db, user, folder.id) or [])
    notes = db.query(Note).filter(Note.owner_id == user.id, Note.deleted_at <= cutoff).all()
    for note in notes:
        if note.folder_id not in deleted_folder_ids:
            stored_names.extend(hard_delete_note(db, user, note.id) or [])
    db.commit()
    unlink_media(stored_names)


def purge_all_expired_trash(db: Session) -> None:
    for user in db.query(User).all():
        purge_expired_trash(db, user)


def hard_delete_note(db: Session, user: User, note_id: int, deleted_only: bool = False) -> list[str] | None:
    query = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id)
    if deleted_only:
        query = query.filter(Note.deleted_at.is_not(None))
    note = query.first()
    if note is None:
        return None
    stored_names = [row.stored_name for row in db.query(Attachment.stored_name).filter(Attachment.note_id == note_id, Attachment.owner_id == user.id).all()]
    db.query(PublicShare).filter(PublicShare.note_id == note_id, PublicShare.owner_id == user.id).delete(synchronize_session=False)
    db.delete(note)
    return stored_names


def hard_delete_folder(db: Session, user: User, folder_id: int, deleted_only: bool = False) -> list[str] | None:
    query = db.query(Folder.id).filter(Folder.id == folder_id, Folder.owner_id == user.id)
    if deleted_only:
        query = query.filter(Folder.deleted_at.is_not(None))
    exists = query.first()
    if exists is None:
        return None
    folder_ids = descendant_folder_ids(db, user, folder_id)
    note_ids = [row.id for row in db.query(Note.id).filter(Note.owner_id == user.id, Note.folder_id.in_(folder_ids)).all()]
    stored_names = [row.stored_name for row in db.query(Attachment.stored_name).filter(Attachment.owner_id == user.id, Attachment.note_id.in_(note_ids)).all()] if note_ids else []
    if note_ids:
        db.query(PublicShare).filter(PublicShare.owner_id == user.id, PublicShare.note_id.in_(note_ids)).delete(synchronize_session=False)
        db.query(Note).filter(Note.owner_id == user.id, Note.id.in_(note_ids)).delete(synchronize_session=False)
    for current_id in reversed(folder_ids):
        db.query(Folder).filter(Folder.owner_id == user.id, Folder.id == current_id).delete(synchronize_session=False)
    return stored_names


def unlink_media(stored_names: list[str]) -> None:
    media_root = Path(get_settings().media_root)
    for stored_name in stored_names:
        path = media_root / stored_name
        if path.exists():
            path.unlink()
