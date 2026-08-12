from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Goal, User
from ..schemas import GoalIn, GoalOut
from ..security import require_user

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(db: Session = Depends(get_db), user: User = Depends(require_user)) -> list[Goal]:
    return db.query(Goal).filter(Goal.owner_id == user.id).order_by(Goal.id.desc()).all()


@router.post("", response_model=GoalOut)
def create_goal(payload: GoalIn, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Goal:
    goal = Goal(**payload.model_dump(), owner_id=user.id)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, payload: GoalIn, db: Session = Depends(get_db), user: User = Depends(require_user)) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.owner_id == user.id).first()
    if goal is None:
        raise HTTPException(404, "Goal not found")
    for key, value in payload.model_dump().items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)) -> None:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.owner_id == user.id).first()
    if goal is None:
        raise HTTPException(404, "Goal not found")
    db.delete(goal)
    db.commit()
