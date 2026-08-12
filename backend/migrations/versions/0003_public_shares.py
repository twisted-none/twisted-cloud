"""Add public note shares.

Revision ID: 0003_public_shares
Revises: 0002_media
Create Date: 2026-05-05
"""

from alembic import op

revision = "0003_public_shares"
down_revision = "0002_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS public_shares (
            id SERIAL PRIMARY KEY,
            token VARCHAR(80) UNIQUE NOT NULL,
            owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_public_shares_token ON public_shares(token)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_public_shares_owner_id ON public_shares(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_public_shares_note_id ON public_shares(note_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public_shares")
