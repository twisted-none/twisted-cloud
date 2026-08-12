"""Add trash retention fields.

Revision ID: 0004_trash
Revises: 0003_public_shares
Create Date: 2026-08-04
"""

from alembic import op

revision = "0004_trash"
down_revision = "0003_public_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    op.execute("ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    op.execute("CREATE INDEX IF NOT EXISTS ix_folders_deleted_at ON folders(deleted_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notes_deleted_at ON notes(deleted_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_notes_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_folders_deleted_at")
    op.execute("ALTER TABLE notes DROP COLUMN IF EXISTS deleted_at")
    op.execute("ALTER TABLE folders DROP COLUMN IF EXISTS deleted_at")
