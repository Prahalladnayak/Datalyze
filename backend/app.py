from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import os
from dotenv import load_dotenv
import asyncpg

# Force absolute path loading of .env so that running the server from any directory works reliably
ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=ENV_PATH, override=True)

# Import routes exactly as expected by front-end
from routes import search, generate, web_extractor, clean, kaggle, model_builder, dataset_understanding, payments, automl
from routes import auth as auth_routes
from routes import admin as admin_routes
from database import init_db

app = FastAPI(
    title="Data Generator Platform API",
    description="Backend system integrating Gemini and Kaggle per user exact endpoints.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect EXACT route prefixes that the React frontend is expecting
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(generate.router, prefix="/api/generate", tags=["Generate"])
app.include_router(web_extractor.router, prefix="/api/extract", tags=["Web Extractor"])
app.include_router(clean.router, prefix="/api/clean", tags=["Clean"])
app.include_router(kaggle.router, prefix="/api/kaggle", tags=["Kaggle Integration"])
app.include_router(model_builder.router, prefix="/api/model-builder", tags=["Model Builder"])
app.include_router(dataset_understanding.router, prefix="/api/dataset-understanding", tags=["Dataset Understanding"])
app.include_router(automl.router, prefix="/api/automl", tags=["AutoML"])

# Auth routes
app.include_router(auth_routes.router, prefix="/api/auth", tags=["Auth"])

# Payments routes
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])

# Admin panel (internal, browser-based, cookie-auth)
app.include_router(admin_routes.router, prefix="/admin", tags=["Admin"])

app_ready = False

@app.middleware("http")
async def readiness_check_middleware(request, call_next):
    # Allow health check, API documentation, and root page to bypass
    if request.url.path in ["/health", "/", "/docs", "/openapi.json"]:
        return await call_next(request)
    
    if not app_ready:
        if request.url.path.startswith("/admin"):
            return HTMLResponse(
                status_code=503,
                content="""
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Datalyze Admin - Server Starting</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                        .card { background-color: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                        h1 { font-size: 24px; margin-bottom: 16px; color: #f8fafc; }
                        p { color: #94a3b8; margin-bottom: 24px; font-size: 15px; line-height: 1.5; }
                        .spinner { border: 3px solid rgba(255,255,255,0.1); border-top-color: #6366f1; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; margin: 0 auto; }
                        @keyframes spin { to { transform: rotate(360deg); } }
                    </style>
                    <script>
                        setInterval(async () => {
                            try {
                                const res = await fetch('/health');
                                const data = await res.json();
                                if (data.ready) {
                                    window.location.reload();
                                }
                            } catch (e) {}
                        }, 2000);
                    </script>
                </head>
                <body>
                    <div class="card">
                        <div class="spinner"></div>
                        <h1 style="margin-top: 24px;">Datalyze Admin Starting Up</h1>
                        <p>The admin services are initializing. This page will reload automatically once the backend is ready.</p>
                    </div>
                </body>
                </html>
                """
            )
        return JSONResponse(
            status_code=503,
            content={"error": True, "detail": "App is starting up. Please wait."}
        )
    return await call_next(request)

@app.on_event("startup")
async def startup_validation():
    global app_ready
    print("[APP] Starting backend initialization sequence...")
    
    # Fail-fast check for critical env variables
    db_url = os.getenv("DATABASE_URL")
    jwt_key = os.getenv("JWT_SECRET_KEY")
    if not db_url or db_url.strip() == "" or "ep-xxx" in db_url or "your_user" in db_url:
        raise RuntimeError("DATABASE_URL is missing or contains placeholder values. Startup aborted.")
    if not jwt_key or jwt_key.strip() == "":
        raise RuntimeError("JWT_SECRET_KEY is missing or empty. Startup aborted.")

    # Initialize database (blocks and retries until Neon DB ready)
    await init_db()

    key = os.getenv("GEMINI_API_KEY")
    if not key:
        print("[WARNING] GEMINI_API_KEY is not set. AI-dependent features will fail.")
    else:
        print(f"[OK] GEMINI_API_KEY loaded ({key[:8]}...)")
        
    app_ready = True
    print("[APP] Backend startup readiness complete. Fully ready to accept traffic.")

@app.exception_handler(asyncpg.PostgresError)
async def postgres_error_handler(request, exc):
    print(f"[DB EXCEPTION HANDLER] asyncpg.PostgresError caught: {exc}")
    return JSONResponse(
        status_code=503,
        content={"error": True, "detail": "Database connection is temporarily unavailable. Please try again shortly."}
    )

@app.exception_handler(asyncpg.InterfaceError)
async def interface_error_handler(request, exc):
    print(f"[DB EXCEPTION HANDLER] asyncpg.InterfaceError caught: {exc}")
    return JSONResponse(
        status_code=503,
        content={"error": True, "detail": "Database connection is temporarily unavailable. Please try again shortly."}
    )

@app.exception_handler(ConnectionError)
async def connection_error_handler(request, exc):
    print(f"[DB EXCEPTION HANDLER] ConnectionError caught: {exc}")
    return JSONResponse(
        status_code=503,
        content={"error": True, "detail": "Database connection is temporarily unavailable. Please try again shortly."}
    )

@app.exception_handler(OSError)
async def os_error_handler(request, exc):
    print(f"[DB EXCEPTION HANDLER] OSError caught: {exc}")
    return JSONResponse(
        status_code=503,
        content={"error": True, "detail": "Database connection is temporarily unavailable. Please try again shortly."}
    )

@app.exception_handler(RuntimeError)
async def runtime_error_handler(request, exc):
    exc_str = str(exc)
    if "pool not" in exc_str.lower() or "database" in exc_str.lower() or "pool" in exc_str.lower():
        print(f"[DB EXCEPTION HANDLER] Database RuntimeError caught: {exc}")
        return JSONResponse(
            status_code=503,
            content={"error": True, "detail": "Database connection is temporarily unavailable. Please try again shortly."}
        )
    return JSONResponse(
        status_code=500,
        content={"error": True, "detail": f"RuntimeError: {exc_str}"}
    )

@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": True, "detail": str(exc.detail)})

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(status_code=422, content={"error": True, "detail": str(exc)})

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Dataset Generator Platform API"}

@app.get("/health")
async def health_check():
    from database import is_db_ready
    db_ok = await is_db_ready()
    if db_ok and app_ready:
        key = os.getenv("GEMINI_API_KEY")
        return {
            "status": "ok",
            "ready": True,
            "api_key_loaded": bool(key),
            "version": "2.0.0"
        }
    return JSONResponse(
        status_code=503,
        content={
            "status": "error",
            "ready": False,
            "detail": "App initializing or database not reachable"
        }
    )
