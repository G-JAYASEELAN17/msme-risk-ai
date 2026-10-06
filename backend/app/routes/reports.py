from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..database import models
from ..auth import get_current_user

router = APIRouter()

@router.get("/{id}")
def get_report(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Query report associated with the assessment ID
    report = db.query(models.Report).filter(models.Report.assessment_id == id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
        
    user_role = (current_user.role or "user").lower()
    # Check that requesting user owns the business OR is an analyst/admin
    if user_role not in ["analyst", "admin"] and report.assessment.business.user_id != current_user.uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this report"
        )

    # Attach live assessment review metadata to report payload
    data = dict(report.report_data)
    data["review_status"] = report.assessment.review_status or "pending"
    data["review_notes"] = report.assessment.review_notes
    data["reviewed_by"] = report.assessment.reviewed_by
    data["reviewed_at"] = report.assessment.reviewed_at.isoformat() if report.assessment.reviewed_at else None
    return data
