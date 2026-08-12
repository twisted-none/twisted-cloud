from datetime import UTC, datetime, timedelta
from functools import lru_cache
import json
from secrets import token_urlsafe
from urllib.request import urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(minutes=settings.access_token_minutes)
    return jwt.encode({"sub": subject, "exp": expires}, settings.jwt_secret, algorithm="HS256")


@lru_cache(maxsize=1)
def _keycloak_jwks() -> dict:
    with urlopen(get_settings().keycloak_jwks_url, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def _decode_keycloak_token(token: str) -> str:
    settings = get_settings()
    header = jwt.get_unverified_header(token)
    key = next((item for item in _keycloak_jwks().get("keys", []) if item.get("kid") == header.get("kid")), None)
    if key is None:
        _keycloak_jwks.cache_clear()
        key = next((item for item in _keycloak_jwks().get("keys", []) if item.get("kid") == header.get("kid")), None)
    if key is None:
        raise JWTError("Keycloak signing key not found")
    payload = jwt.decode(token, key, algorithms=["RS256"], issuer=settings.keycloak_issuer_url, options={"verify_aud": False})
    if payload.get("azp") != settings.keycloak_client_id:
        raise JWTError("Invalid Keycloak client")
    email = payload.get("email") or payload.get("preferred_username")
    if not email:
        raise JWTError("Keycloak token has no user email")
    return str(email)


def _token_subject(token: str) -> str:
    alg = jwt.get_unverified_header(token).get("alg")
    if alg == "HS256":
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        email = payload.get("sub")
    elif alg == "RS256":
        email = _decode_keycloak_token(token)
    else:
        raise JWTError("Unsupported token algorithm")
    if not email:
        raise JWTError("Token has no subject")
    return str(email)


def _get_or_create_user(db: Session, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(email=email, password_hash=hash_password(token_urlsafe(48)))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            raise
    else:
        db.refresh(user)
    return user


def require_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    try:
        email = _token_subject(token)
    except JWTError as exc:
        raise credentials_error from exc
    return _get_or_create_user(db, email)
