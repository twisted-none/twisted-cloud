from io import BytesIO
from pathlib import PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Folder, Note, User
from ..schemas import VaultImportResult
from ..security import require_user

router = APIRouter(prefix="/vault", tags=["vault"])


def safe_name(value: str) -> str:
    name = "".join(ch if ch.isalnum() or ch in " ._-" else "_" for ch in value).strip()
    return name or "untitled"


def folder_path(folder: Folder | None, folders: dict[int, Folder]) -> str:
    parts: list[str] = []
    seen: set[int] = set()
    while folder and folder.id not in seen:
        seen.add(folder.id)
        parts.append(safe_name(folder.name))
        folder = folders.get(folder.parent_id or 0)
    return "/".join(reversed(parts))


@router.get("/export.zip")
def export_vault(db: Session = Depends(get_db), user: User = Depends(require_user)) -> Response:
    folders = {f.id: f for f in db.query(Folder).filter(Folder.owner_id == user.id, Folder.deleted_at.is_(None)).all()}
    notes = db.query(Note).filter(Note.owner_id == user.id, Note.deleted_at.is_(None)).order_by(Note.title).all()
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for note in notes:
            prefix = folder_path(folders.get(note.folder_id or 0), folders)
            filename = f"{safe_name(note.title)}-{note.id}.md"
            archive.writestr(f"{prefix}/{filename}" if prefix else filename, note.content)
    return Response(buffer.getvalue(), media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="twisted-vault.zip"'})


@router.post("/import", response_model=VaultImportResult)
async def import_vault(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(require_user)) -> VaultImportResult:
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(413, "Archive is too large")
    folders_by_path: dict[str, Folder] = {}
    folder_count = 0
    note_count = 0
    with ZipFile(BytesIO(data)) as archive:
        for entry in archive.infolist():
            path = PurePosixPath(entry.filename.replace("\\", "/"))
            if entry.is_dir() or path.is_absolute() or ".." in path.parts or path.suffix.lower() != ".md":
                continue
            parent_id: int | None = None
            current = ""
            for part in path.parts[:-1]:
                current = f"{current}/{part}" if current else part
                if current not in folders_by_path:
                    folder = Folder(name=safe_name(part), parent_id=parent_id, owner_id=user.id)
                    db.add(folder)
                    db.flush()
                    folders_by_path[current] = folder
                    folder_count += 1
                parent_id = folders_by_path[current].id
            title = safe_name(path.stem)
            content = archive.read(entry).decode("utf-8", errors="replace")
            db.add(Note(title=title[:180], content=content, folder_id=parent_id, owner_id=user.id))
            note_count += 1
    db.commit()
    return VaultImportResult(folders=folder_count, notes=note_count)
