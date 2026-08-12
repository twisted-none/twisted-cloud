import os
import sys
import unittest
from datetime import timedelta
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.test")
os.environ.setdefault("ADMIN_PASSWORD", "password")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.models import Base, Folder, Note, User
from app.routers import folders, notes, trash
from app.security import require_user
from app.trash_service import TRASH_RETENTION, utc_now


class TrashApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)
        Base.metadata.create_all(self.engine)
        with self.SessionLocal() as db:
            self.user = User(email="owner@example.test", password_hash="hash")
            db.add(self.user)
            db.commit()
            db.refresh(self.user)
            self.user_id = self.user.id
        app = FastAPI()
        app.include_router(folders.router, prefix="/api")
        app.include_router(notes.router, prefix="/api")
        app.include_router(trash.router, prefix="/api")
        app.dependency_overrides[get_db] = self.get_db
        app.dependency_overrides[require_user] = self.current_user
        self.client = TestClient(app)

    def get_db(self):
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def current_user(self) -> User:
        with self.SessionLocal() as db:
            return db.get(User, self.user_id)

    def test_delete_restore_and_purge_note(self) -> None:
        note_id = self.client.post("/api/notes", json={"title": "Draft", "content": "Body", "folder_id": None}).json()["id"]
        self.assertEqual(self.client.delete(f"/api/notes/{note_id}").status_code, 204)
        self.assertEqual(self.client.get("/api/notes").json(), [])
        trash_items = self.client.get("/api/trash").json()
        self.assertEqual(trash_items[0]["kind"], "note")
        self.assertEqual(self.client.post(f"/api/trash/notes/{note_id}/restore").status_code, 200)
        self.assertEqual(len(self.client.get("/api/notes").json()), 1)
        self.client.delete(f"/api/notes/{note_id}")
        with self.SessionLocal() as db:
            note = db.get(Note, note_id)
            note.deleted_at = utc_now() - TRASH_RETENTION - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.client.get("/api/trash").json(), [])
        with self.SessionLocal() as db:
            self.assertIsNone(db.get(Note, note_id))

    def test_folder_delete_restores_tree_and_blocks_cycles(self) -> None:
        root = self.client.post("/api/folders", json={"name": "Root", "parent_id": None}).json()
        child = self.client.post("/api/folders", json={"name": "Child", "parent_id": root["id"]}).json()
        note = self.client.post("/api/notes", json={"title": "Nested", "content": "", "folder_id": child["id"]}).json()
        blocked = self.client.put(f"/api/folders/{root['id']}", json={"name": "Root", "parent_id": child["id"]})
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(self.client.delete(f"/api/folders/{root['id']}").status_code, 204)
        self.assertEqual(self.client.get("/api/folders").json(), [])
        self.assertEqual(self.client.get("/api/notes").json(), [])
        self.assertEqual(self.client.post(f"/api/trash/folders/{root['id']}/restore").status_code, 200)
        self.assertEqual({item["id"] for item in self.client.get("/api/folders").json()}, {root["id"], child["id"]})
        self.assertEqual(self.client.get("/api/notes").json()[0]["id"], note["id"])


if __name__ == "__main__":
    unittest.main()
