from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database.database import get_db

router = APIRouter()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_dialect = "unknown"
    try:
        bind = db.get_bind()
        db_dialect = bind.dialect.name
        # Run a simple test query to verify DB connectivity
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        
    return {
        "status": "healthy" if "unhealthy" not in db_status else "degraded",
        "database": db_status,
        "database_type": db_dialect
    }

