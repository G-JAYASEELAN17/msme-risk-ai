import time
import uuid
import logging
from collections import defaultdict
from fastapi import FastAPI, Request, Response, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database.database import engine, Base, SessionLocal
from .database import models
from .routes import health, prediction, assessment, reports, business, documents, notifications, user, search, demo
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
    expose_headers=["X-Request-ID"]
)

# ----------------- RATE LIMITING FOR SENSITIVE ENDPOINTS -----------------
# Simple thread-safe in-memory sliding window rate limiter
_RATE_LIMITS = {
    "/api/predict": (60, 60),               # 60 req / 60 sec
    "/api/documents/upload": (30, 60),      # 30 uploads / 60 sec
    "/api/assessments": (60, 60),           # 60 creations / 60 sec
    "/api/demo/assess": (30, 60),           # 30 demo evaluations / 60 sec
    "/api/demo/simulate": (30, 60),         # 30 demo simulations / 60 sec
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

    response = await call_next(request)

    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id

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
def root_health():
    """Top-level health check endpoint for cloud load balancers and deployment platforms."""
    from sqlalchemy import text
    db = SessionLocal()
    db_dialect = "unknown"
    try:
        bind = db.get_bind()
        db_dialect = bind.dialect.name
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    finally:
        db.close()

    is_healthy = "unhealthy" not in db_status
    return {
        "status": "healthy" if is_healthy else "degraded",
        "application": "healthy",
        "database": db_status,
        "database_type": db_dialect,
        "environment": settings.APP_ENV,
        "version": settings.MODEL_VERSION
    }

@app.get("/ready", tags=["health"])
def root_ready(response: Response):
    """Top-level readiness probe for deployment orchestration (Render, Railway, Kubernetes)."""
    from sqlalchemy import text
    db = SessionLocal()
    db_ready = False
    try:
        db.execute(text("SELECT 1"))
        db_ready = True
    except Exception:
        db_ready = False
    finally:
        db.close()

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
app.add_api_route(f"{settings.API_V1_STR}/admin/audit-logs", user.get_admin_audit_logs, methods=["GET"], tags=["admin"])

# ----------------- OPTIONAL DEMO SEEDING (CONTROLLED BY ENV) -----------------
def seed_db():
    """Seeds the database with initial demo MSME assessments ONLY if explicitly enabled in configuration."""
    if not settings.SEED_DEMO_DATA:
        return

    import datetime
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            logger.info("SEED_DEMO_DATA is true. Seeding demo portfolio data...")
            demo_user = models.User(
                uid="demo_risk_analyst",
                email="analyst@msmerisk.ai",
                name="Demo Risk Analyst",
                role="admin"
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

            mock_data = [
                {
                    "business": {
                        "name": "Aster Manufacturing",
                        "industry": "Manufacturing",
                        "location": "Chicago, IL",
                        "age": 8,
                        "employees": 45
                    },
                    "assessment": {
                        "annual_revenue": 2500000.0,
                        "monthly_cash_flow": 180000.0,
                        "monthly_expenses": 96000.0,
                        "existing_debt": 300000.0,
                        "digital_transactions": 450,
                        "utility_payment_score": 92.0,
                        "invoice_payment_score": 88.0,
                        "previous_defaults": 0
                    }
                }
            ]

            from .services.report_service import report_service

            for data in mock_data:
                bus_info = data["business"]
                business_obj = models.Business(
                    user_id=demo_user.uid,
                    name=bus_info["name"],
                    industry=bus_info["industry"],
                    location=bus_info.get("location", "United States"),
                    age=bus_info["age"],
                    employees=bus_info["employees"]
                )
                db.add(business_obj)
                db.commit()
                db.refresh(business_obj)

                ass_info = data["assessment"]
                created_at = datetime.datetime.utcnow()

                assessment_obj = models.Assessment(
                    business_id=business_obj.id,
                    annual_revenue=ass_info["annual_revenue"],
                    monthly_cash_flow=ass_info["monthly_cash_flow"],
                    monthly_expenses=ass_info["monthly_expenses"],
                    existing_debt=ass_info["existing_debt"],
                    digital_transactions=ass_info["digital_transactions"],
                    utility_payment_score=ass_info["utility_payment_score"],
                    invoice_payment_score=ass_info["invoice_payment_score"],
                    previous_defaults=ass_info["previous_defaults"],
                    created_at=created_at
                )
                db.add(assessment_obj)
                db.commit()
                db.refresh(assessment_obj)

                combined_info = {**bus_info, **ass_info}
                prediction_result = prediction_service.predict_risk(combined_info)

                prediction_obj = models.Prediction(
                    assessment_id=assessment_obj.id,
                    default_probability=prediction_result["default_probability"],
                    risk_level=prediction_result["risk_level"],
                    confidence=prediction_result["confidence"],
                    top_factors=prediction_result["top_factors"],
                    positive_factors=prediction_result.get("positive_factors", []),
                    risk_factors=prediction_result.get("risk_factors", []),
                    model_version=settings.MODEL_VERSION,
                    created_at=created_at
                )
                db.add(prediction_obj)

                report_data = report_service.generate_report_data(
                    business_data=combined_info,
                    assessment_data=combined_info,
                    prediction_data=prediction_result,
                    model_version=settings.MODEL_VERSION
                )
                
                report_obj = models.Report(
                    assessment_id=assessment_obj.id,
                    report_data=report_data,
                    created_at=created_at
                )
                db.add(report_obj)
                db.commit()
            logger.info("Demo data seeded successfully.")
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

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
