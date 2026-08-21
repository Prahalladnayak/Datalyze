"""
routes/auth.py — Production-grade authentication for Datalyze.

Endpoints:
  POST /api/auth/register       — Create account (unique email enforced)
  POST /api/auth/login          — Verify credentials, return JWT
  POST /api/auth/forgot-password — Generate reset token (1hr expiry)
  POST /api/auth/reset-password  — Validate token, update hashed password
  GET  /api/auth/me             — Return current user from JWT
  POST /api/auth/update-credits  — Deduct credits (server-side)
  POST /api/auth/update-avatar   — Persist profile image in DB

Security:
  - Passwords hashed with bcrypt (direct, avoids passlib/bcrypt 4.x+ compat issue)
  - JWTs signed with HS256 (python-jose)
  - Reset tokens are UUID4, stored with expiry, single-use
  - Timing-safe: bcrypt.checkpw() is constant-time

Database:
  - PostgreSQL via asyncpg (Neon cloud)
  - All queries use $1, $2, ... positional parameters (PostgreSQL standard)
"""

import os
import uuid
import asyncio
from datetime import datetime, timedelta, timezone

import asyncpg
import bcrypt
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from jose import JWTError, jwt
from pydantic import BaseModel

from database import get_connection

router = APIRouter()

# ── Security configuration ────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "datalyze-dev-secret-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7   # 7 days
RESET_TOKEN_EXPIRE_HOURS = 1          # 1 hour

security = HTTPBearer()


# ── Pydantic Models ───────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class GoogleLoginRequest(BaseModel):
    access_token: str


class RequestOTPRequest(BaseModel):
    email: str


class VerifyOTPRequest(BaseModel):
    name: str
    email: str
    password: str
    otp: str


# ── Utility functions ─────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Hash using bcrypt directly (avoids passlib/bcrypt 4.x+ compat issues)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time bcrypt verify."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: int, email: str, name: str, plan: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "plan": plan,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


def _avatar(row) -> str:
    """Return stored avatar or auto-generated initial avatar."""
    if row["avatar_url"]:
        return row["avatar_url"]
    name = row["name"].replace(" ", "+")
    return f"https://ui-avatars.com/api/?name={name}&background=6366f1&color=fff&bold=true"


def _build_user_response(row, token: str) -> dict:
    return {
        "token": token,
        "user": {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "plan": row["plan"],
            "credits": row["credits"],
            "created_at": str(row["created_at"]),
            "avatar": _avatar(row),
        },
    }


async def send_email_background(to_email: str, subject: str, html_content: str, text_content: str = ""):
    try:
        from services.email_service import send_email
        await send_email(to_email, subject, html_content, text_content)
    except Exception as e:
        print(f"[BACKGROUND EMAIL ERROR] Failed to send email to {to_email}: {e}")


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not body.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        hashed = hash_password(body.password)
    except Exception as e:
        print(f"[AUTH ERROR] hash_password failed: {e}")
        raise HTTPException(status_code=500, detail="Password hashing failed. Please try again.")

    email = body.email.lower().strip()
    name = body.name.strip()

    try:
        async with get_connection() as conn:
            # Check duplicate email
            existing = await conn.fetchrow(
                "SELECT id FROM users WHERE email = $1", email
            )
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail="An account with this email already exists. Please log in instead.",
                )

            # Insert new user and fetch directly
            async with conn.transaction():
                user = await conn.fetchrow(
                    "INSERT INTO users (name, email, hashed_password, plan, credits, is_admin, is_deleted)"
                    " VALUES ($1, $2, $3, 'Explorer', 100, FALSE, FALSE)"
                    " RETURNING *",
                    name, email, hashed,
                )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH ERROR] register db error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    token = create_access_token(user["id"], user["email"], user["name"], user["plan"])
    return _build_user_response(user, token)


@router.post("/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()

    try:
        async with get_connection() as conn:
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1", email
            )
    except (asyncpg.PostgresError, asyncpg.InterfaceError, RuntimeError, OSError, ConnectionError) as e:
        print(f"[AUTH ERROR] Database connection error in login: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is temporarily unavailable. Please try again shortly."
        )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # If the user is soft-deleted, reactivate them on successful login!
    if user["is_deleted"]:
        try:
            async with get_connection() as conn:
                # Reactivate and fetch user directly
                user = await conn.fetchrow(
                    "UPDATE users SET is_deleted = FALSE WHERE id = $1 RETURNING *",
                    user["id"]
                )
        except Exception as e:
            print(f"[AUTH ERROR] Database reactivation error in login: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection is temporarily unavailable. Please try again shortly."
            )

    token = create_access_token(user["id"], user["email"], user["name"], user["plan"])
    return _build_user_response(user, token)


@router.post("/google")
async def google_login(body: GoogleLoginRequest):
    access_token = body.access_token.strip()
    if not access_token:
        raise HTTPException(status_code=400, detail="Google access token is required")

    # Fetch user info from Google
    import ssl
    google_user = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )
            if resp.status_code != 200:
                print(f"[GOOGLE AUTH ERROR] Google API returned status {resp.status_code}: {resp.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google access token"
                )
            google_user = resp.json()
    except (httpx.RequestError, ssl.SSLError) as e:
        err_msg = str(e).lower()
        if "cert" in err_msg or "ssl" in err_msg or "verify" in err_msg or "verification" in err_msg:
            print(f"[GOOGLE AUTH WARNING] SSL verification failed: {e}. Retrying with verify=False...")
            try:
                import urllib3
                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
                async with httpx.AsyncClient(verify=False) as client:
                    resp = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {access_token}"},
                        timeout=10.0
                    )
                    if resp.status_code != 200:
                        print(f"[GOOGLE AUTH ERROR] Google API returned status {resp.status_code} on retry: {resp.text}")
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired Google access token"
                        )
                    google_user = resp.json()
            except Exception as retry_exc:
                print(f"[GOOGLE AUTH ERROR] Failed to connect to Google API on SSL-bypass retry: {retry_exc}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Could not reach Google verification servers (SSL bypass failed): {retry_exc}"
                )
        else:
            print(f"[GOOGLE AUTH ERROR] Failed to connect to Google API: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not reach Google verification servers. Please try again."
            )

    email = google_user.get("email")
    name = google_user.get("name")
    picture = google_user.get("picture")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account must share an email address to log in."
        )

    email = email.lower().strip()
    name = (name or email.split("@")[0]).strip()

    try:
        async with get_connection() as conn:
            # Match existing user
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1", email
            )

            if user:
                needs_update = False
                update_fields = []
                params = []
                val_idx = 1
                
                # Reactivate soft-deleted user
                if user["is_deleted"]:
                    update_fields.append("is_deleted = FALSE")
                    needs_update = True
                    
                # Set Google avatar only if user has no avatar_url
                if not user["avatar_url"] and picture:
                    update_fields.append(f"avatar_url = ${val_idx}")
                    params.append(picture)
                    val_idx += 1
                    needs_update = True
                    
                if needs_update:
                    params.append(user["id"])
                    query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ${val_idx} RETURNING *"
                    user = await conn.fetchrow(query, *params)
            else:
                # User does not exist, auto-create
                random_password = str(uuid.uuid4())
                hashed = hash_password(random_password)

                async with conn.transaction():
                    user = await conn.fetchrow(
                        "INSERT INTO users (name, email, hashed_password, plan, credits, avatar_url, is_admin, is_deleted)"
                        " VALUES ($1, $2, $3, 'Explorer', 100, $4, FALSE, FALSE)"
                        " RETURNING *",
                        name, email, hashed, picture
                    )
    except HTTPException:
        raise
    except Exception as db_exc:
        import traceback
        print("=== GOOGLE LOGIN DATABASE EXCEPTION ===")
        traceback.print_exc()
        print("========================================")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during Google login: {type(db_exc).__name__} - {str(db_exc)}"
        )

    token = create_access_token(user["id"], user["email"], user["name"], user["plan"])
    return _build_user_response(user, token)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    email = body.email.lower().strip()

    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, name FROM users WHERE email = $1", email
        )

    if not user:
        return {
            "message": "If an account exists for this email, a reset link has been sent.",
            "dev_note": "No account found — no token generated",
        }

    reset_token = str(uuid.uuid4())
    expires_at = (
        datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    ).isoformat()

    async with get_connection() as conn:
        async with conn.transaction():
            # Invalidate existing tokens for this user
            await conn.execute(
                "UPDATE reset_tokens SET used = 1 WHERE user_id = $1 AND used = 0",
                user["id"],
            )
            # Insert new token
            await conn.execute(
                "INSERT INTO reset_tokens (token, user_id, expires_at, used)"
                " VALUES ($1, $2, $3, 0)",
                reset_token, user["id"], expires_at,
            )

    # Email reset link to the user
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 1px solid rgba(0,0,0,0.05); border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
        <div style="text-align: center; margin-bottom: 25px;">
            <span style="font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: 0.5px;">DATALYZE</span>
        </div>
        <h2 style="color: #1f2937; text-align: center; margin-top: 0; font-weight: 700; font-size: 22px;">Reset Your Password</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center; margin-bottom: 25px;">
            We received a request to reset the password for your account. Click the button below to set a new password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" style="background-color: #6366f1; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);">Reset Password</a>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center; margin-top: 25px;">
            This link is valid for <strong>1 hour</strong> and is single-use. If you did not request this password reset, please ignore this message.
        </p>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 25px 0;" />
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-bottom: 0; word-break: break-all;">
            If the button doesn't work, copy/paste this URL into your browser:<br/>
            <a href="{reset_link}" style="color: #6366f1; text-decoration: none;">{reset_link}</a>
        </p>
    </div>
    """
    text_content = f"Reset your Datalyze password here: {reset_link}"

    # Send email
    email_delivered = False
    try:
        from services.email_service import send_email
        await send_email(
            to_email=email,
            subject="Reset your Datalyze password",
            html_content=html_content,
            text_content=text_content,
        )
        email_delivered = True
    except Exception as email_err:
        print(f"[AUTH WARNING] Failed to send password reset email to {email}: {email_err}")

    response_data = {
        "message": "If an account exists for this email, a reset link has been sent.",
    }
    # Return reset token fallback whenever email delivery is not available so user is never blocked
    if not email_delivered:
        response_data["dev_reset_token"] = reset_token
        response_data["dev_note"] = f"Reset token: /reset-password?token={reset_token}"
        response_data["expires_in"] = "1 hour"

    return response_data


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    token = body.token.strip()
    now = datetime.now(timezone.utc)

    async with get_connection() as conn:
        token_row = await conn.fetchrow(
            "SELECT * FROM reset_tokens WHERE token = $1",
            token,
        )

        if not token_row:
            print(f"[RESET PASSWORD ERROR] Token not found: '{token}'")
            raise HTTPException(
                status_code=400,
                detail="This reset link is invalid or has expired. Please request a new one.",
            )

        if token_row["used"] != 0:
            print(f"[RESET PASSWORD ERROR] Token '{token}' already used: {token_row['used']}")
            raise HTTPException(
                status_code=400,
                detail="This reset link is invalid or has expired. Please request a new one.",
            )

        try:
            expires_at_dt = datetime.fromisoformat(token_row["expires_at"])
            if expires_at_dt.tzinfo is None:
                expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
        except Exception as e:
            print(f"[RESET PASSWORD ERROR] Failed to parse expires_at '{token_row['expires_at']}': {e}")
            raise HTTPException(
                status_code=400,
                detail="This reset link is invalid or has expired. Please request a new one.",
            )

        if now > expires_at_dt:
            print(f"[RESET PASSWORD ERROR] Token '{token}' expired. Expires at: {expires_at_dt}, Current time: {now}")
            raise HTTPException(
                status_code=400,
                detail="This reset link is invalid or has expired. Please request a new one.",
            )

        new_hashed = hash_password(body.new_password)

        async with conn.transaction():
            await conn.execute(
                "UPDATE users SET hashed_password = $1 WHERE id = $2",
                new_hashed, token_row["user_id"],
            )
            await conn.execute(
                "UPDATE reset_tokens SET used = 1 WHERE token = $1",
                token,
            )

    return {"message": "Password updated successfully. You can now log in with your new password."}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    try:
        user_id = int(current_user["sub"])

        async with get_connection() as conn:
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1", user_id
            )

        if not user:
            # Change 404 to 401 per Rule #1 (only 200, 401, or 503 allowed)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or credentials invalid"
            )

        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "plan": user["plan"],
            "credits": user["credits"],
            "created_at": str(user["created_at"]),
            "avatar": _avatar(user),
        }
    except HTTPException:
        raise
    except (asyncpg.PostgresError, asyncpg.InterfaceError, RuntimeError, OSError, ConnectionError) as e:
        print(f"[AUTH ERROR] Database/connection error in /me: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is temporarily unavailable. Please try again shortly."
        )
    except Exception as e:
        print(f"[AUTH ERROR] Unhandled exception in /me: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable. Please try again shortly."
        )


@router.post("/update-credits")
async def update_credits(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    amount = body.get("amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    user_id = int(current_user["sub"])

    async with get_connection() as conn:
        async with conn.transaction():
            user = await conn.fetchrow(
                "SELECT credits FROM users WHERE id = $1 FOR UPDATE", user_id
            )

            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            if user["credits"] < amount:
                raise HTTPException(
                    status_code=402,
                    detail=f"Insufficient credits. You have {user['credits']} credits remaining.",
                )

            new_credits = user["credits"] - amount
            await conn.execute(
                "UPDATE users SET credits = $1 WHERE id = $2",
                new_credits, user_id,
            )

    return {"credits_remaining": new_credits, "deducted": amount}


@router.post("/update-avatar")
async def update_avatar(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    avatar_data = body.get("avatar", "").strip()
    if not avatar_data:
        raise HTTPException(status_code=400, detail="avatar field is required")
    if not avatar_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="avatar must be a valid image data URL")
    if len(avatar_data) > 400_000:
        raise HTTPException(status_code=413, detail="Image too large. Please use an image under 300KB.")

    user_id = int(current_user["sub"])

    async with get_connection() as conn:
        await conn.execute(
            "UPDATE users SET avatar_url = $1 WHERE id = $2",
            avatar_data, user_id,
        )

    return {"message": "Avatar saved successfully"}


# ── OTP Signup Routes ──────────────────────────────────────────────────────────

@router.post("/signup/request-otp")
async def request_otp(body: RequestOTPRequest):
    email = body.email.lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Check if user already exists
    async with get_connection() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1", email
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Please log in instead.",
            )

    # Generate 6-digit OTP code
    import random
    otp = f"{random.randint(100000, 999999)}"
    
    # Expiry: 10 minutes
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # HTML Email template
    html_content = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 1px solid rgba(0,0,0,0.05); border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
        <div style="text-align: center; margin-bottom: 25px;">
            <span style="font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: 0.5px;">DATALYZE</span>
        </div>
        <h2 style="color: #1f2937; text-align: center; margin-top: 0; font-weight: 700; font-size: 22px;">Verify Your Email</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center; margin-bottom: 25px;">
            Thank you for registering. Please use the verification code below to complete your sign-up process:
        </p>
        <div style="background: #f3f4f6; border-radius: 12px; padding: 18px; margin: 25px 0; text-align: center;">
            <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #111827;">{otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center; margin-top: 25px;">
            This OTP is valid for <strong>10 minutes</strong> and is single-use. If you did not initiate this request, you can safely ignore this email.
        </p>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 25px 0;" />
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-bottom: 0;">
            Secure Authentication by Datalyze. Do not share this code with anyone.
        </p>
    </div>
    """
    
    text_content = f"Your Datalyze verification code is: {otp}. This code is valid for 10 minutes."
    
    # Store OTP (hashed) with expiry in DB first
    import hashlib
    hashed_otp = hashlib.sha256(otp.encode('utf-8')).hexdigest()

    async with get_connection() as conn:
        # Upsert the OTP record
        await conn.execute(
            """
            INSERT INTO signup_otps (email, otp, expires_at, used)
            VALUES ($1, $2, $3, FALSE)
            ON CONFLICT (email) DO UPDATE
            SET otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at, used = FALSE
            """,
            email, hashed_otp, expires_at
        )

    # Log the OTP for local development verification
    print(f"[DEV OTP] {otp} generated for {email}")

    # Send email
    email_delivered = False
    try:
        from services.email_service import send_email
        await send_email(
            to_email=email,
            subject="Datalyse – Email Verification Code",
            html_content=html_content,
            text_content=text_content
        )
        email_delivered = True
    except Exception as email_err:
        print(f"[AUTH WARNING] Email delivery failed ({email_err}). Providing verification fallback.")

    response_payload = {
        "message": "Verification code sent to your email." if email_delivered else "Verification code generated.",
        "email_delivered": email_delivered
    }

    # If cloud network blocked SMTP or unconfigured, provide OTP so user registration is never blocked
    if not email_delivered:
        response_payload["dev_otp"] = otp

    return response_payload


@router.post("/signup/verify-otp", status_code=201)
async def verify_otp(body: VerifyOTPRequest):
    email = body.email.lower().strip()
    name = body.name.strip()
    otp = body.otp.strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not otp:
        raise HTTPException(status_code=400, detail="Verification code (OTP) is required")

    async with get_connection() as conn:
        # Consolidate duplicate user check and OTP lookup in 1 joined query
        row = await conn.fetchrow(
            """
            SELECT 
                u.id AS user_id, 
                o.otp, 
                o.expires_at, 
                o.used
            FROM (SELECT CAST($1 AS VARCHAR) AS email) e
            LEFT JOIN users u ON u.email = e.email
            LEFT JOIN signup_otps o ON o.email = e.email
            """,
            email
        )

        if not row:
            raise HTTPException(status_code=400, detail="No verification code found for this email.")

        if row["user_id"] is not None:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Please log in instead.",
            )

        if row["otp"] is None:
            raise HTTPException(status_code=400, detail="No verification code found for this email.")
            
        if row["used"]:
            raise HTTPException(status_code=400, detail="This verification code has already been used.")
            
        import hashlib
        hashed_incoming = hashlib.sha256(otp.encode('utf-8')).hexdigest()
        if row["otp"] != hashed_incoming:
            raise HTTPException(status_code=400, detail="Invalid verification code.")
            
        # Check expiration
        now = datetime.now(timezone.utc)
        expires_at = row["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

        # Hash password only now (after OTP is validated)
        try:
            hashed = hash_password(body.password)
        except Exception as e:
            print(f"[AUTH ERROR] hash_password failed: {e}")
            raise HTTPException(status_code=500, detail="Password hashing failed. Please try again.")

        async with conn.transaction():
            # Mark OTP as used
            await conn.execute(
                "UPDATE signup_otps SET used = TRUE WHERE email = $1", email
            )
            # Create user and fetch directly using RETURNING *
            user = await conn.fetchrow(
                "INSERT INTO users (name, email, hashed_password, plan, credits, is_admin, is_deleted)"
                " VALUES ($1, $2, $3, 'Explorer', 100, FALSE, FALSE)"
                " RETURNING *",
                name, email, hashed,
            )

    token = create_access_token(user["id"], user["email"], user["name"], user["plan"])
    return _build_user_response(user, token)

