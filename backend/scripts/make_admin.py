"""
scripts/make_admin.py
─────────────────────
Grants admin access to a user by email.

Usage:
    cd backend
    python scripts/make_admin.py prahalladnayak873@gmail.com

This sets is_admin = TRUE in the PostgreSQL users table.
The change takes effect immediately — no restart needed.
"""

import asyncio
import os
import re
import ssl
import sys

import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def _build_dsn() -> str:
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return re.sub(r"[?&]sslmode=\w+", "", url)


async def make_admin(email: str):
    email = email.lower().strip()
    dsn = _build_dsn()
    ssl_ctx = ssl.create_default_context()

    conn = await asyncpg.connect(dsn=dsn, ssl=ssl_ctx)

    user = await conn.fetchrow("SELECT id, name, email, is_admin FROM users WHERE email = $1", email)

    if not user:
        print(f"[ERROR] No user found with email: {email}")
        await conn.close()
        sys.exit(1)

    if user["is_admin"]:
        print(f"[INFO]  {email} is already an admin. No change made.")
        await conn.close()
        return

    await conn.execute("UPDATE users SET is_admin = TRUE WHERE email = $1", email)
    await conn.close()

    print(f"[OK]    Admin access granted to: {user['name']} ({email})")
    print(f"        They can now log in at: http://localhost:8000/admin/login")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/make_admin.py <email>")
        sys.exit(1)
    asyncio.run(make_admin(sys.argv[1]))
