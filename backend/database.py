"""
database.py — PostgreSQL async database setup for Datalyze (Neon via asyncpg).

Connection strategy:
  - asyncpg connection pool (min=2, max=10)
  - SSL required (Neon enforces it)
  - Pool created once on startup via init_db()
  - All routes consume connections via get_connection() context manager

Schema:
  users         — id, name, email (UNIQUE), hashed_password, plan, credits, avatar_url, created_at
  reset_tokens  — token (PK), user_id (FK), expires_at, used
"""

import asyncpg
import os
import re
import ssl
from contextlib import asynccontextmanager

# ── Connection pool (module-level singleton) ──────────────────────────────────
_pool: asyncpg.Pool | None = None


def _build_dsn() -> str:
    """
    Build a clean DSN from DATABASE_URL env var.
    Strips ?sslmode=require — SSL is passed as a parameter to asyncpg directly.
    """
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError(
            "[DB] DATABASE_URL is not set. "
            "Add it to backend/.env — get it from your Neon dashboard."
        )
    # asyncpg handles SSL via ssl= kwarg; strip the query param to avoid conflicts
    return re.sub(r"[?&]sslmode=\w+", "", url)


# ── PostgreSQL table definitions ──────────────────────────────────────────────
CREATE_USERS_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'Explorer',
    credits         INTEGER NOT NULL DEFAULT 100,
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_RESET_TOKENS_SQL = """
CREATE TABLE IF NOT EXISTS reset_tokens (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
);
"""

CREATE_SIGNUP_OTPS_SQL = """
CREATE TABLE IF NOT EXISTS signup_otps (
    email      TEXT PRIMARY KEY,
    otp        TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT FALSE
);
"""

CREATE_PAYMENTS_SQL = """
CREATE TABLE IF NOT EXISTS payments (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    plan_name           TEXT NOT NULL,
    amount              INTEGER NOT NULL,
    credits_added       INTEGER NOT NULL,
    razorpay_order_id   TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT,
    status              TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_EMAIL_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
"""

CREATE_SIGNUP_OTPS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_signup_otps_email ON signup_otps(email);
"""

CREATE_RESET_TOKENS_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(token);
"""

CREATE_RESET_TOKENS_USER_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON reset_tokens(user_id);
"""



def _patch_asyncio_dns():
    """
    Windows asyncio IPv6 fallback bug workaround.
    Reorders getaddrinfo results to prioritize IPv4 (AF_INET) over IPv6.
    """
    try:
        import socket
        import asyncio
        loop = asyncio.get_event_loop()
        if getattr(loop, "_dns_patched", False):
            return

        original_getaddrinfo = loop.getaddrinfo

        async def custom_getaddrinfo(host, port, *args, **kwargs):
            results = await original_getaddrinfo(host, port, *args, **kwargs)
            return sorted(results, key=lambda r: 0 if r[0] == socket.AF_INET else 1)

        loop.getaddrinfo = custom_getaddrinfo
        loop._dns_patched = True
        print("[DB] Asyncio event loop DNS patched to prioritize IPv4.")
    except Exception as e:
        print(f"[DB] Warning: Failed to patch asyncio DNS: {e}")


# ── Pool lifecycle ────────────────────────────────────────────────────────────
import asyncio

async def init_db():
    """
    Called once at FastAPI startup (app.py).
    Creates the asyncpg connection pool and ensures tables exist.
    Blocks and retries on database connection failure.
    """
    global _pool

    _patch_asyncio_dns()

    dsn = _build_dsn()
    ssl_ctx = ssl.create_default_context()  # validates Neon's TLS certificate

    max_retries = 15
    retry_delay = 2

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[DB] Connection attempt {attempt}/{max_retries}...")
            _pool = await asyncpg.create_pool(
                dsn=dsn,
                ssl=ssl_ctx,
                min_size=2,
                max_size=10,
                command_timeout=30,
            )

            # Verify the pool is active by acquiring a connection
            async with _pool.acquire() as conn:
                await conn.execute(CREATE_USERS_SQL)
                await conn.execute(CREATE_RESET_TOKENS_SQL)
                await conn.execute(CREATE_SIGNUP_OTPS_SQL)
                await conn.execute(CREATE_PAYMENTS_SQL)
                await conn.execute(CREATE_EMAIL_INDEX_SQL)
                await conn.execute(CREATE_SIGNUP_OTPS_INDEX_SQL)
                await conn.execute(CREATE_RESET_TOKENS_INDEX_SQL)
                await conn.execute(CREATE_RESET_TOKENS_USER_INDEX_SQL)

                # ── Safe column migrations (run on every startup, idempotent) ─────────
                # Each ALTER TABLE is wrapped in try/except — safe to run multiple times.
                _migrations = [
                    ("avatar_url",  "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url  TEXT"),
                    ("is_admin",    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin     BOOLEAN NOT NULL DEFAULT FALSE"),
                    ("is_deleted",  "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted   BOOLEAN NOT NULL DEFAULT FALSE"),
                ]
                for col, sql in _migrations:
                    try:
                        await conn.execute(sql)
                        print(f"[DB] Column ensured: users.{col}")
                    except Exception:
                        pass  # Column already exists — safe to ignore

                # Enforce defaults for is_admin and is_deleted (clean up any legacy NULLs)
                try:
                    await conn.execute("UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL")
                    await conn.execute("UPDATE users SET is_deleted = FALSE WHERE is_deleted IS NULL")
                    print("[DB] Null database fields normalized (is_admin, is_deleted)")
                except Exception as e:
                    print(f"[DB] Warning: database normalization failed: {e}")

                # ── activity_logs table (structure only, no data) ─────────────────────
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id           SERIAL PRIMARY KEY,
                        user_id      INTEGER NOT NULL REFERENCES users(id),
                        action       TEXT NOT NULL,
                        detail       TEXT,
                        credits_used INTEGER NOT NULL DEFAULT 0,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

                # Indexes (IF NOT EXISTS — safe to repeat)
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted)"
                )
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)"
                )

            print("[DB] Connected to PostgreSQL (Neon) — pool ready")
            return
        except Exception as e:
            print(f"[DB] Connection attempt {attempt} failed: {e}")
            if _pool:
                try:
                    await _pool.close()
                except Exception:
                    pass
                _pool = None
            if attempt == max_retries:
                print("[DB] Fatal: Max database connection retries reached. Exiting.")
                raise e
            print(f"[DB] Retrying in {retry_delay} seconds...")
            await asyncio.sleep(retry_delay)


async def is_db_ready() -> bool:
    """Check if the connection pool is initialized and database query can execute."""
    global _pool
    if _pool is None:
        return False
    try:
        async with _pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return True
    except Exception:
        return False


async def close_db():
    """Call on shutdown to gracefully drain the pool."""
    global _pool
    if _pool:
        await _pool.close()
        print("[DB] PostgreSQL pool closed")


# ── Connection context manager (used in all routes) ───────────────────────────
@asynccontextmanager
async def get_connection():
    """
    Async context manager that acquires a connection from the pool.

    Usage:
        async with get_connection() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    """
    if _pool is None:
        raise RuntimeError("[DB] Pool not initialised. Was init_db() called?")
    async with _pool.acquire() as conn:
        yield conn


# ── Backward-compat alias (imported by auth.py) ───────────────────────────────
get_db = get_connection
