from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterRequest(LoginRequest):
    pass


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent_id: int | None = None


class FolderOut(FolderIn):
    id: int
    owner_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class NoteIn(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    content: str = ""
    folder_id: int | None = None


class NoteOut(NoteIn):
    id: int
    owner_id: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrashItemOut(BaseModel):
    kind: str
    id: int
    title: str
    parent_id: int | None = None
    deleted_at: datetime
    expires_at: datetime


class NoteVersionOut(BaseModel):
    id: int
    note_id: int
    title: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    kind: str
    id: int
    title: str
    snippet: str | None = None
    folder_id: int | None = None


class AttachmentOut(BaseModel):
    id: int
    note_id: int | None
    original_name: str
    content_type: str
    size: int
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VaultImportResult(BaseModel):
    folders: int
    notes: int


class PublicShareOut(BaseModel):
    token: str
    note_id: int
    url: str


class PublicNoteOut(BaseModel):
    title: str
    content: str
    updated_at: datetime


class GoalIn(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    target: float = Field(gt=0)
    current: float = Field(ge=0)
    unit: str = Field(default="RUB", min_length=1, max_length=40)
    deadline: str | None = Field(default=None, max_length=20)


class GoalOut(GoalIn):
    id: int
    owner_id: int

    model_config = {"from_attributes": True}
