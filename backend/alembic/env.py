"""
alembic/env.py — Alembic migration environment.

Uses psycopg2 (sync) for running migrations.
The app itself uses asyncpg (async) at runtime.
This is the standard industry pattern.
"""

import os
import re
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from dotenv import load_dotenv

# Load .env so DATABASE_URL is available
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def get_sync_url() -> str:
    """
    Build a psycopg2-compatible sync URL from DATABASE_URL.
    Neon URLs use postgresql:// — psycopg2 needs postgresql+psycopg2://
    sslmode=require is kept (psycopg2 supports it natively).
    """
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set in .env")

    # Replace scheme for psycopg2 driver
    url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def run_migrations_offline() -> None:
    url = get_sync_url()
    context.configure(
        url=url,
        target_metadata=None,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    sync_url = get_sync_url()
    config.set_main_option("sqlalchemy.url", sync_url)

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
