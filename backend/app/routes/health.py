from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database.database import get_db
from ..config import settings
from ..services.prediction_service import prediction_service

router = APIRouter()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Standard application liveness and database connectivity health probe.
    """
    db_dialect = "unknown"
    try:
        bind = db.get_bind()
        db_dialect = bind.dialect.name
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    is_healthy = "unhealthy" not in db_status

    return {
        "status": "healthy" if is_healthy else "degraded",
        "application": "healthy",
        "database": db_status,
        "database_type": db_dialect,
        "environment": settings.APP_ENV,
        "version": settings.MODEL_VERSION
    }

@router.get("/health/ready")
@router.get("/ready")
def readiness_check(response: Response, db: Session = Depends(get_db)):
    """
    Readiness probe: Verifies database connectivity and ML prediction pipeline initialization.
    """
    db_ready = False
    try:
        db.execute(text("SELECT 1"))
        db_ready = True
    except Exception:
        db_ready = False

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
        "model_version": settings.MODEL_VERSION,
        "environment": settings.APP_ENV
    }
