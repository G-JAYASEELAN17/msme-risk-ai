"""
FastAPI router for Applicant Corrections & Resubmissions
Endpoints:
- POST /corrections: Submit correction for declared field or replacement document
- GET /corrections: List corrections for user or business
- POST /corrections/{id}/review: Underwriter review action (ACCEPTED | REJECTED)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.identity_and_bank import (
    ApplicantCorrectionCreateRequest,
    ApplicantCorrectionReviewRequest,
    ApplicantCorrectionResponse
)
from ..services.correction_service import CorrectionService
from ..services.audit_service import log_audit_event

router = APIRouter(prefix="/corrections", tags=["Applicant Corrections & Resubmissions"])

def to_correction_response(c: models.ApplicantCorrection) -> ApplicantCorrectionResponse:
    return ApplicantCorrectionResponse(
        id=c.id,
        user_id=c.user_id,
        business_id=c.business_id,
        field_name=c.field_name,
        original_value=c.original_value,
        corrected_value=c.corrected_value,
        reason=c.reason,
        replaced_document_id=c.replaced_document_id,
        new_document_id=c.new_document_id,
        submitted_by=c.submitted_by,
        status=c.status,
        analyst_notes=c.analyst_notes,
        reviewed_by=c.reviewed_by,
        reviewed_at=c.reviewed_at.isoformat() if c.reviewed_at else None,
        created_at=c.created_at.isoformat() if c.created_at else "",
        recalculated_at=c.recalculated_at.isoformat() if c.recalculated_at else None
    )

@router.post("", response_model=ApplicantCorrectionResponse, status_code=status.HTTP_201_CREATED)
def submit_correction(
    payload: ApplicantCorrectionCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits an applicant correction for an inaccurate declared value or attaches a replacement document.
    Preserves original submitted value, reason, and full audit history.
    """
    bus = db.query(models.Business).filter(models.Business.id == payload.business_id).first()
    if not bus or (bus.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized business access.")

    service = CorrectionService(db)
    correction = service.submit_correction(
        user_id=current_user.uid,
        business_id=payload.business_id,
        field_name=payload.field_name,
        corrected_value=payload.corrected_value,
        reason=payload.reason,
        original_value=payload.original_value,
        replaced_document_id=payload.replaced_document_id,
        new_document_id=payload.new_document_id
    )
    return to_correction_response(correction)

@router.get("", response_model=List[ApplicantCorrectionResponse])
def list_corrections(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists correction requests for the current user or underwriting queue."""
    lookup_uid = current_user.uid
    if target_user_id and target_user_id != current_user.uid:
        if current_user.role not in ["analyst", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access.")
        lookup_uid = target_user_id
    elif current_user.role in ["analyst", "admin"] and not target_user_id and not business_id:
        lookup_uid = None  # Analysts can view all pending corrections

    service = CorrectionService(db)
    corrections = service.list_corrections(user_id=lookup_uid, business_id=business_id)
    return [to_correction_response(c) for c in corrections]

@router.post("/{id}/review", response_model=ApplicantCorrectionResponse)
def review_correction(
    id: int,
    payload: ApplicantCorrectionReviewRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Underwriter review decision (ACCEPTED | REJECTED) for an applicant correction.
    Restricted to credit analyst and admin roles.
    """
    if current_user.role not in ["analyst", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only credit risk analysts can review corrections.")

    service = CorrectionService(db)
    try:
        correction = service.review_correction(
            correction_id=id,
            analyst_uid=current_user.uid,
            decision=payload.decision,
            notes=payload.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return to_correction_response(correction)
