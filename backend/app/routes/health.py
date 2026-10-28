from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from ..database.database import engine, get_db
from ..database.diagnostics import diagnose_database_connection
from ..database import models
from ..config import settings
from ..services.prediction_service import prediction_service
from ..auth import require_role

router = APIRouter()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Standard application liveness and database connectivity health probe.
    Does not leak credentials, sensitive connection details, or internal stack traces.
    """
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


@router.get("/health/ready")
@router.get("/ready")
def readiness_check(response: Response, db: Session = Depends(get_db)):
    """
    Readiness probe for deployment orchestration (Kubernetes, Render, Railway).
    Returns HTTP 200 when ready to accept traffic; HTTP 503 when critical dependencies are down.
    """
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
        "model_version": settings.MODEL_VERSION,
        "environment": settings.APP_ENV
    }


@router.get("/admin/system/database-diagnostics")
def admin_database_diagnostics(current_user: models.User = Depends(require_role(["admin"]))):
    """
    Secure administrative database inspection endpoint.
    Restricted strictly to authorized administrators. Never returns credentials or secrets.
    """
    diag = diagnose_database_connection(target_engine=engine)
    
    # Safe host sanitization
    host_display = "none"
    port_display = None
    if engine and engine.url:
        host_display = engine.url.host or "local"
        port_display = engine.url.port

    return {
        "connectivity": diag["status"],
        "connected": diag["connected"],
        "dialect": diag["dialect"],
        "driver": diag["driver"],
        "latency_ms": diag["latency_ms"],
        "target_host": host_display,
        "target_port": port_display,
        "failure_category": diag.get("failure_category"),
        "failure_message": diag.get("message"),
        "pool_size": getattr(engine.pool, "size", lambda: None)() if hasattr(engine, "pool") else None,
        "alembic_head": "i1a2b3c4d5e6",
        "timestamp": diag.get("latency_ms")
    }
