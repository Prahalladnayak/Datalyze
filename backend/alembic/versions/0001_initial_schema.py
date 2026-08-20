"""Initial schema — users and reset_tokens tables.

Revision ID: 0001
Revises:
Create Date: 2026-05-13
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              SERIAL PRIMARY KEY,
            name            TEXT NOT NULL,
            email           TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            plan            TEXT NOT NULL DEFAULT 'Explorer',
            credits         INTEGER NOT NULL DEFAULT 100,
            avatar_url      TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS reset_tokens (
            token      TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id),
            expires_at TEXT NOT NULL,
            used       INTEGER NOT NULL DEFAULT 0
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_users_email")
    op.execute("DROP TABLE IF EXISTS reset_tokens")
    op.execute("DROP TABLE IF EXISTS users")
