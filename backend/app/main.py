import time
import uuid
import logging
from collections import defaultdict
from asyncio import CancelledError
try:
    from uvicorn.protocols.utils import ClientDisconnected
except ImportError:
    class ClientDisconnected(Exception):
        pass
from fastapi import FastAPI, Request, Response, status, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database.database import engine, Base, SessionLocal, get_db
from .database import models
from .routes import health, prediction, assessment, reports, business, documents, notifications, user, search, demo, identity, bank_accounts, corrections, financial_intelligence, explainability, decision_intelligence
from .services.prediction_service import prediction_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("msme_risk_api")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="MSME Risk AI Credit Assessment & Decision-Support API",
    version=settings.MODEL_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# ----------------- CORS CONFIGURATION -----------------
# Configurable through CORS_ORIGINS environment variable. Wildcards are strictly rejected.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Server-Timing"]
)

# ----------------- RATE LIMITING FOR SENSITIVE ENDPOINTS -----------------
# Simple thread-safe in-memory sliding window rate limiter
_RATE_LIMITS = {
    "/api/predict": (60, 60),               # 60 req / 60 sec
    "/api/documents/upload": (30, 60),      # 30 uploads / 60 sec
    "/api/assessments": (60, 60),           # 60 creations / 60 sec
    "/api/demo/assess": (30, 60),           # 30 demo evaluations / 60 sec
    "/api/demo/simulate": (30, 60),         # 30 demo simulations / 60 sec
    "/api/identity/verify-pan": (30, 60),    # 30 req / 60 sec
    "/api/identity/verify-aadhaar": (30, 60),# 30 req / 60 sec
    "/api/explainability": (30, 60),        # 30 req / 60 sec
}
_request_history = defaultdict(list)

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    path = request.url.path
    # Check if path matches rate-limited prefix for mutating methods
    if request.method in ("POST", "PUT", "DELETE"):
        for sensitive_path, (max_calls, window_seconds) in _RATE_LIMITS.items():
            if path.startswith(sensitive_path):
                client_ip = request.client.host if request.client else "unknown"
                key = f"{client_ip}:{sensitive_path}"
                now = time.time()
                
                # Filter old calls outside window
                _request_history[key] = [t for t in _request_history[key] if now - t < window_seconds]
                if len(_request_history[key]) >= max_calls:
                    logger.warning(f"Rate limit exceeded for {key}")
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={
                            "error": True,
                            "message": "Too many requests. Please slow down and try again later.",
                            "status_code": 429
                        }
                    )
                _request_history[key].append(now)
                break

    return await call_next(request)

# ----------------- REQUEST ID & STRUCTURED LOGGING MIDDLEWARE -----------------
@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    start_time = time.time()

    try:
        response = await call_next(request)
    except (ClientDisconnected, CancelledError):
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"[{request_id}] Client disconnected during {request.method} {request.url.path} ({duration_ms}ms)"
        )
        return Response(status_code=499)

    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["Server-Timing"] = f"total;dur={duration_ms}"

    # Exclude routine health probes from chatty request logs
    if not request.url.path.endswith("/health"):
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)"
        )

    return response

# ----------------- SECURITY HEADERS MIDDLEWARE -----------------
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ----------------- SAFE EXCEPTION HANDLERS -----------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = request.headers.get("X-Request-ID", "unknown")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id
        },
        headers=exc.headers
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("X-Request-ID", "unknown")
    if isinstance(exc, (ClientDisconnected, CancelledError)):
        logger.info(f"[{request_id}] Client disconnected on {request.method} {request.url.path}")
        return Response(status_code=499)
    logger.error(f"[{request_id}] Unhandled internal exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error. Please contact system administrator with the request ID.",
            "status_code": 500,
            "request_id": request_id
        }
    )

# ----------------- TOP-LEVEL HEALTH & READINESS PROBES -----------------
@app.get("/health", tags=["health"])
def root_health(db: Session = Depends(get_db)):
    """Top-level health check endpoint for cloud load balancers and deployment platforms."""
    from .database.diagnostics import diagnose_database_connection
    target_engine = None
    try:
        target_engine = db.get_bind()
    except Exception:
        target_engine = engine

    diag = diagnose_database_connection(target_engine=target_engine)
    is_healthy = diag["connected"]

    resp = {
        "status": "healthy" if is_healthy else "degraded",
        "application": "healthy",
        "database": "healthy" if is_healthy else "unavailable",
        "database_type": diag["dialect"],
        "latency_ms": diag["latency_ms"],
        "environment": settings.APP_ENV,
        "version": settings.MODEL_VERSION
    }
    if not is_healthy:
        resp["failure_category"] = diag["failure_category"]
        resp["message"] = diag["message"]
    return resp

@app.get("/ready", tags=["health"])
def root_ready(response: Response, db: Session = Depends(get_db)):
    """Top-level readiness probe for deployment orchestration (Render, Railway, Kubernetes)."""
    from .database.diagnostics import diagnose_database_connection
    target_engine = None
    try:
        target_engine = db.get_bind()
    except Exception:
        target_engine = engine

    diag = diagnose_database_connection(target_engine=target_engine)
    db_ready = diag["connected"]

    model_ready = False
    try:
        model = prediction_service.load_model()
        model_ready = model is not None
    except Exception:
        model_ready = False

    is_ready = db_ready and model_ready
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "ready": is_ready,
        "database": "ready" if db_ready else "not_ready",
        "database_failure_category": diag.get("failure_category"),
        "ml_model": "loaded" if model_ready else "fallback_mode",
        "version": settings.MODEL_VERSION,
        "environment": settings.APP_ENV
    }

# ----------------- ROUTERS INCLUSION -----------------
app.include_router(health.router, prefix=f"{settings.API_V1_STR}", tags=["health"])
app.include_router(prediction.router, prefix=f"{settings.API_V1_STR}", tags=["prediction"])
app.include_router(assessment.router, prefix=f"{settings.API_V1_STR}/assessments", tags=["assessments"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(business.router, prefix=f"{settings.API_V1_STR}/businesses", tags=["businesses"])
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}/documents", tags=["documents"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])
app.include_router(user.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(search.router, prefix=f"{settings.API_V1_STR}/search", tags=["search"])
app.include_router(demo.router, prefix=f"{settings.API_V1_STR}/demo", tags=["demo"])
app.include_router(identity.router, prefix=f"{settings.API_V1_STR}", tags=["identity"])
app.include_router(bank_accounts.router, prefix=f"{settings.API_V1_STR}", tags=["bank-accounts"])
app.include_router(corrections.router, prefix=f"{settings.API_V1_STR}", tags=["corrections"])
app.include_router(financial_intelligence.router, prefix=f"{settings.API_V1_STR}", tags=["financial-intelligence"])
app.include_router(explainability.router, prefix=f"{settings.API_V1_STR}", tags=["explainability"])
app.include_router(decision_intelligence.router, prefix=f"{settings.API_V1_STR}", tags=["decision-intelligence"])
app.add_api_route(f"{settings.API_V1_STR}/admin/audit-logs", user.get_admin_audit_logs, methods=["GET"], tags=["admin"])

# Ensure all database tables exist safely on startup
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning(f"Notice: Table initialization skipped or deferred: {e}")

# ----------------- DEMO SEEDING DISABLED -----------------
# Demo-account creation and demo-account shortcuts are completely disabled for security.
def seed_db():
    """No-op: Demo-account creation disabled for production-grade security."""
    pass

seed_db()

@app.get("/")
def read_root():
    return {
        "message": "Welcome to MSME Risk AI backend API server.",
        "version": settings.MODEL_VERSION,
        "environment": settings.APP_ENV,
        "docs_url": "/docs",
        "health_url": "/health"
    }
