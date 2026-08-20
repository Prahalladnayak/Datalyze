"""Add is_deleted (soft delete) and activity_logs table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-13
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Soft delete flag on users
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted)"
    )

    # Activity logs — structure only, no data yet
    op.execute("""
        CREATE TABLE IF NOT EXISTS activity_logs (
            id           SERIAL PRIMARY KEY,
            user_id      INTEGER NOT NULL REFERENCES users(id),
            action       TEXT NOT NULL,
            detail       TEXT,
            credits_used INTEGER NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS activity_logs")
    op.execute("DROP INDEX IF EXISTS idx_users_is_deleted")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_deleted")
