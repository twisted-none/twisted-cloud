"""Initial vault schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-29
"""

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS folders (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            title VARCHAR(180) NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id SERIAL PRIMARY KEY,
            title VARCHAR(180) NOT NULL,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            target DOUBLE PRECISION NOT NULL,
            current DOUBLE PRECISION NOT NULL DEFAULT 0,
            unit VARCHAR(40) NOT NULL DEFAULT 'RUB',
            deadline VARCHAR(20)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS note_versions (
            id SERIAL PRIMARY KEY,
            note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            title VARCHAR(180) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """)
    op.execute("ALTER TABLE folders ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE notes ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE goals ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_folders_owner_id ON folders(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notes_owner_id ON notes(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_goals_owner_id ON goals(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_note_versions_note_id ON note_versions(note_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS note_versions")
    op.execute("DROP TABLE IF EXISTS goals")
    op.execute("DROP TABLE IF EXISTS notes")
    op.execute("DROP TABLE IF EXISTS folders")
    op.execute("DROP TABLE IF EXISTS users")
