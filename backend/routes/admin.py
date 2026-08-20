"""
routes/admin.py — Professional admin dashboard for Datalyze.

Endpoints:
  GET  /admin/login              — Login form
  POST /admin/login              — Authenticate admin
  GET  /admin                    — Dashboard (search/filter/sort/paginate)
  POST /admin/users/{id}/edit    — Edit name/plan/credits
  POST /admin/users/{id}/delete  — Soft delete user
  POST /admin/users/{id}/toggle-admin — Toggle is_admin flag
  POST /admin/users/{id}/credits — Add/remove credits
  GET  /admin/logout             — Clear cookie

Security:
  - Every route validates httponly cookie + is_admin=TRUE in DB
  - Self-deletion and self-role-removal are blocked
  - Soft delete: sets is_deleted=TRUE, never drops rows
"""

import os
from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from database import get_connection
from routes.auth import verify_password, decode_token, create_access_token

router = APIRouter()

_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
templates = Jinja2Templates(directory=_TEMPLATE_DIR)

COOKIE_NAME  = "admin_token"
COOKIE_TTL   = 60 * 60 * 8   # 8 hours
VALID_PLANS  = {"Explorer", "Starter", "Builder", "Pro", "ULTRA"}
VALID_SORTS  = {"created_at", "credits", "name", "email"}


# ── Auth helper ────────────────────────────────────────────────────────────────
async def _get_admin(request: Request):
    """Returns the admin user row or None. Never raises."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        return None
    uid = int(payload["sub"])
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, name, email, is_admin FROM users "
            "WHERE id = $1 AND is_admin = TRUE AND is_deleted = FALSE",
            uid,
        )
    return user or None


def _login_redirect():
    return RedirectResponse(url="/admin/login", status_code=302)


# ── Login ──────────────────────────────────────────────────────────────────────
@router.get("/login", response_class=HTMLResponse)
async def admin_login_page(request: Request):
    if await _get_admin(request):
        return RedirectResponse(url="/admin", status_code=302)
    return templates.TemplateResponse(
        "admin/login.html", {"request": request, "error": None}
    )


@router.post("/login")
async def admin_login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
):
    email = email.lower().strip()
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT * FROM users WHERE email=$1 AND is_admin=TRUE AND is_deleted=FALSE",
            email,
        )
    if not user or not verify_password(password, user["hashed_password"]):
        return templates.TemplateResponse(
            "admin/login.html",
            {"request": request, "error": "Invalid credentials or no admin access."},
            status_code=401,
        )
    token = create_access_token(user["id"], user["email"], user["name"], user["plan"])
    resp = RedirectResponse(url="/admin", status_code=302)
    resp.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax",
                    secure=False, max_age=COOKIE_TTL)
    return resp


# ── Dashboard ──────────────────────────────────────────────────────────────────
@router.get("", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    plan_filter: str = "",
    role_filter: str = "",
    sort: str = "created_at",
    sort_dir: str = "desc",
):
    admin = await _get_admin(request)
    if not admin:
        return _login_redirect()

    per_page = per_page if per_page in (10, 20, 50) else 20
    sort     = sort     if sort in VALID_SORTS else "created_at"
    order    = "DESC"   if sort_dir != "asc"  else "ASC"
    page     = max(1, page)
    offset   = (page - 1) * per_page

    async with get_connection() as conn:
        # ── Metrics ──────────────────────────────────────────────────────────
        total_users    = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE is_admin=FALSE AND is_deleted=FALSE"
        )
        total_admins   = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE is_admin=TRUE AND is_deleted=FALSE"
        )
        active_users   = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE credits>0  AND is_deleted=FALSE AND is_admin=FALSE"
        )
        inactive_users = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE credits=0  AND is_deleted=FALSE AND is_admin=FALSE"
        )
        total_credits  = await conn.fetchval(
            "SELECT COALESCE(SUM(credits),0) FROM users WHERE is_deleted=FALSE"
        )

        # ── Plan distribution ─────────────────────────────────────────────────
        plan_dist = await conn.fetch(
            "SELECT plan, COUNT(*) AS cnt FROM users "
            "WHERE is_deleted=FALSE AND is_admin=FALSE GROUP BY plan ORDER BY cnt DESC"
        )

        # ── Dynamic filter query ──────────────────────────────────────────────
        conds = ["is_deleted = FALSE"]
        args  = []
        n     = 1

        if search:
            conds.append(f"(LOWER(name) LIKE ${n} OR LOWER(email) LIKE ${n})")
            args.append(f"%{search.lower()}%")
            n += 1
        if plan_filter and plan_filter in VALID_PLANS:
            conds.append(f"plan = ${n}")
            args.append(plan_filter)
            n += 1
        if role_filter == "admin":
            conds.append("is_admin = TRUE")
        elif role_filter == "user":
            conds.append("is_admin = FALSE")

        where = " AND ".join(conds)

        total_filtered = await conn.fetchval(
            f"SELECT COUNT(*) FROM users WHERE {where}", *args
        )
        users = await conn.fetch(
            f"SELECT id, name, email, plan, credits, is_admin, is_deleted, created_at "
            f"FROM users WHERE {where} "
            f"ORDER BY {sort} {order} "
            f"LIMIT ${n} OFFSET ${n+1}",
            *args, per_page, offset,
        )

    total_pages = max(1, -(-total_filtered // per_page))

    return templates.TemplateResponse("admin/dashboard.html", {
        "request":       request,
        "admin":         admin,
        "total_users":   total_users,
        "total_admins":  total_admins,
        "active_users":  active_users,
        "inactive_users":inactive_users,
        "total_credits": total_credits,
        "plan_dist":     plan_dist,
        "users":         users,
        "total_filtered":total_filtered,
        "total_pages":   total_pages,
        "page":          page,
        "per_page":      per_page,
        "search":        search,
        "plan_filter":   plan_filter,
        "role_filter":   role_filter,
        "sort":          sort,
        "sort_dir":      "desc" if order == "DESC" else "asc",
    })


# ── User action APIs ───────────────────────────────────────────────────────────
@router.post("/users/{user_id}/edit")
async def edit_user(user_id: int, request: Request):
    if not await _get_admin(request):
        raise HTTPException(403, "Admin access required")
    body   = await request.json()
    name   = str(body.get("name", "")).strip()
    plan   = str(body.get("plan", "")).strip()
    creds  = body.get("credits")

    if plan and plan not in VALID_PLANS:
        raise HTTPException(400, f"Invalid plan. Valid: {', '.join(VALID_PLANS)}")

    async with get_connection() as conn:
        if not await conn.fetchrow(
            "SELECT id FROM users WHERE id=$1 AND is_deleted=FALSE", user_id
        ):
            raise HTTPException(404, "User not found")
        if name:
            await conn.execute("UPDATE users SET name=$1 WHERE id=$2", name, user_id)
        if plan:
            await conn.execute("UPDATE users SET plan=$1 WHERE id=$2", plan, user_id)
        if creds is not None:
            await conn.execute("UPDATE users SET credits=$1 WHERE id=$2",
                               max(0, int(creds)), user_id)
        row = await conn.fetchrow(
            "SELECT id,name,email,plan,credits,is_admin FROM users WHERE id=$1", user_id
        )
    return JSONResponse({"success": True, "user": dict(row)})


@router.post("/users/{user_id}/delete")
async def delete_user(user_id: int, request: Request):
    admin = await _get_admin(request)
    if not admin:
        raise HTTPException(403, "Admin access required")
    if user_id == admin["id"]:
        raise HTTPException(400, "Cannot delete your own account")
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, email FROM users WHERE id=$1 AND is_deleted=FALSE", user_id
        )
        if not row:
            raise HTTPException(404, "User not found")
        await conn.execute("UPDATE users SET is_deleted=TRUE WHERE id=$1", user_id)
    return JSONResponse({"success": True, "message": f"{row['email']} soft-deleted"})


@router.post("/users/{user_id}/toggle-admin")
async def toggle_admin_role(user_id: int, request: Request):
    admin = await _get_admin(request)
    if not admin:
        raise HTTPException(403, "Admin access required")
    if user_id == admin["id"]:
        raise HTTPException(400, "Cannot change your own admin role")
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, is_admin FROM users WHERE id=$1 AND is_deleted=FALSE", user_id
        )
        if not row:
            raise HTTPException(404, "User not found")
        new_role = not row["is_admin"]
        await conn.execute("UPDATE users SET is_admin=$1 WHERE id=$2", new_role, user_id)
    return JSONResponse({"success": True, "is_admin": new_role})


@router.post("/users/{user_id}/credits")
async def adjust_credits(user_id: int, request: Request):
    if not await _get_admin(request):
        raise HTTPException(403, "Admin access required")
    body   = await request.json()
    action = body.get("action", "")
    try:
        amount = int(body.get("amount", 0))
        assert amount > 0
    except (ValueError, AssertionError):
        raise HTTPException(400, "amount must be a positive integer")

    async with get_connection() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT id, credits FROM users WHERE id=$1 AND is_deleted=FALSE FOR UPDATE", user_id
            )
            if not row:
                raise HTTPException(404, "User not found")
            if action == "add":
                new_c = row["credits"] + amount
            elif action == "remove":
                new_c = max(0, row["credits"] - amount)
            else:
                raise HTTPException(400, "action must be 'add' or 'remove'")
            await conn.execute("UPDATE users SET credits=$1 WHERE id=$2", new_c, user_id)
    return JSONResponse({"success": True, "credits": new_c})


# ── Logout ─────────────────────────────────────────────────────────────────────
@router.get("/logout")
async def admin_logout():
    resp = RedirectResponse(url="/admin/login", status_code=302)
    resp.delete_cookie(COOKIE_NAME)
    return resp
