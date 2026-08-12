from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..config import get_settings
from ..schemas import LoginRequest, RegisterRequest, Token
from ..security import create_access_token, hash_password, require_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    return Token(access_token=create_access_token(user.email))


@router.post("/register", response_model=Token)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> Token:
    if not get_settings().allow_registration:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is disabled")
    if db.query(User).filter(User.email == payload.email).first() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "User already exists")
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    return Token(access_token=create_access_token(user.email))


@router.get("/me")
def me(user: User = Depends(require_user)) -> dict[str, str | int]:
    return {"id": user.id, "email": user.email}
