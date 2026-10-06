from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user

router = APIRouter()

@router.get("")
def global_search(
    q: str = Query(..., min_length=1, description="Search term for businesses, assessments, or industries"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Global search returning matching businesses and assessments for authorized user.
    """
    term = f"%{q.strip()}%"

    # Search businesses
    businesses = db.query(models.Business).filter(
        models.Business.user_id == current_user.uid,
        (models.Business.name.ilike(term) | models.Business.industry.ilike(term) | models.Business.location.ilike(term))
    ).limit(10).all()

    # Search assessments
    assessments = db.query(
        models.Assessment.id,
        models.Business.name.label("business_name"),
        models.Business.industry,
        models.Assessment.created_at,
        models.Prediction.default_probability,
        models.Prediction.risk_level
    ).join(
        models.Business, models.Assessment.business_id == models.Business.id
    ).join(
        models.Prediction, models.Prediction.assessment_id == models.Assessment.id
    ).filter(
        models.Business.user_id == current_user.uid,
        (models.Business.name.ilike(term) | models.Business.industry.ilike(term) | models.Prediction.risk_level.ilike(term))
    ).order_by(models.Assessment.created_at.desc()).limit(10).all()

    # Search documents
    documents = db.query(models.Document).filter(
        models.Document.user_id == current_user.uid,
        models.Document.original_filename.ilike(term)
    ).limit(5).all()

    return {
        "query": q,
        "businesses": [
            {
                "id": b.id,
                "name": b.name,
                "industry": b.industry,
                "location": b.location,
                "age": b.age,
                "employees": b.employees,
                "link": f"/businesses?id={b.id}"
            }
            for b in businesses
        ],
        "assessments": [
            {
                "id": a.id,
                "business_name": a.business_name,
                "industry": a.industry,
                "default_probability": a.default_probability,
                "risk_level": a.risk_level,
                "created_at": a.created_at.isoformat(),
                "link": f"/reports?id={a.id}"
            }
            for a in assessments
        ],
        "documents": [
            {
                "id": d.id,
                "filename": d.original_filename,
                "file_size": d.file_size,
                "status": d.status,
                "link": "/documents"
            }
            for d in documents
        ]
    }
