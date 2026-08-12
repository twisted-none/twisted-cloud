"""Add media attachments.

Revision ID: 0002_media
Revises: 0001_initial
Create Date: 2026-04-29
"""

from alembic import op

revision = "0002_media"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id SERIAL PRIMARY KEY,
            owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
            original_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(255) UNIQUE NOT NULL,
            content_type VARCHAR(120) NOT NULL,
            size INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_attachments_owner_id ON attachments(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_attachments_note_id ON attachments(note_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS attachments")
