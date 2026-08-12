from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Folder, Goal, Note, User
from ..schemas import SearchResult
from ..security import require_user

router = APIRouter(prefix="/search", tags=["search"])


def snippet(text: str, query: str, limit: int = 180) -> str:
    index = text.lower().find(query.lower())
    if index < 0:
        return text[:limit]
    start = max(index - 50, 0)
    return text[start:start + limit]


@router.get("", response_model=list[SearchResult])
def search(
    q: str = Query(min_length=1, max_length=120),
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> list[SearchResult]:
    pattern = f"%{q}%"
    notes = db.query(Note).filter(Note.owner_id == user.id, Note.deleted_at.is_(None), or_(Note.title.ilike(pattern), Note.content.ilike(pattern))).limit(25).all()
    folders = db.query(Folder).filter(Folder.owner_id == user.id, Folder.deleted_at.is_(None), Folder.name.ilike(pattern)).limit(10).all()
    goals = db.query(Goal).filter(Goal.owner_id == user.id, Goal.title.ilike(pattern)).limit(10).all()
    results = [SearchResult(kind="note", id=n.id, title=n.title, snippet=snippet(n.content, q), folder_id=n.folder_id) for n in notes]
    results += [SearchResult(kind="folder", id=f.id, title=f.name, folder_id=f.parent_id) for f in folders]
    results += [SearchResult(kind="goal", id=g.id, title=g.title, snippet=f"{g.current} / {g.target} {g.unit}") for g in goals]
    return results
