"""
FastAPI router for Identity Verification (PAN & Aadhaar)
Endpoints:
- POST /identity/verify-pan: Validate PAN structure, cross-check with declared records, check external provider
- POST /identity/verify-aadhaar: Validate Aadhaar with informed consent, enforce masking (XXXX-XXXX-1234)
- GET /identity/status: Return unified 6-stage identity verification results
- POST /identity/{id}/analyst-review: Underwriter review action (APPROVED, REJECTED, INVESTIGATION_REQUIRED, NEEDS_CLARIFICATION)
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.identity_and_bank import (
    PANVerificationRequest,
    AadhaarVerificationRequest,
    IdentityVerificationResponse,
    IdentityStatusResponse,
    AnalystIdentityReviewRequest
)
from ..services.identity_service import IdentityVerificationEngine
from ..services.audit_service import log_audit_event

router = APIRouter(prefix="/identity", tags=["Identity Verification"])

def to_identity_response(record: models.IdentityVerification) -> IdentityVerificationResponse:
    return IdentityVerificationResponse(
        id=record.id,
        user_id=record.user_id,
        business_id=record.business_id,
        document_id=record.document_id,
        id_type=record.id_type,
        masked_id=record.masked_id,
        name_on_doc=record.name_on_doc,
        entity_type=record.entity_type,
        consent_obtained=record.consent_obtained,
        document_uploaded=record.document_uploaded,
        text_extracted=record.text_extracted,
        extraction_confidence=record.extraction_confidence,
        format_valid=record.format_valid,
        format_validation_notes=record.format_validation_notes,
        declared_name_match=record.declared_name_match,
        name_match_score=record.name_match_score,
        declared_details_match=record.declared_details_match,
        match_breakdown=record.match_breakdown or {},
        external_verification_status=record.external_verification_status,
        external_verification_source=record.external_verification_source,
        external_verification_ref=record.external_verification_ref,
        external_verification_message=record.external_verification_message,
        manual_review_status=record.manual_review_status,
        analyst_decision=record.analyst_decision,
        analyst_notes=record.analyst_notes,
        reviewed_by=record.reviewed_by,
        reviewed_at=record.reviewed_at.isoformat() if record.reviewed_at else None,
        created_at=record.created_at.isoformat() if record.created_at else "",
        updated_at=record.updated_at.isoformat() if record.updated_at else "",
    )

@router.post("/verify-pan", response_model=IdentityVerificationResponse)
def verify_pan_endpoint(
    payload: PANVerificationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits and verifies PAN identifier format, entity type, and correlation with declared applicant details.
    Distinguishes format validation from external verification.
    """
    # Verify business ownership if business_id provided
    if payload.business_id:
        bus = db.query(models.Business).filter(models.Business.id == payload.business_id).first()
        if not bus or (bus.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized business access.")

    engine = IdentityVerificationEngine(db)
    record = engine.verify_pan_document(
        user_id=current_user.uid,
        business_id=payload.business_id,
        document_id=payload.document_id,
        extracted_pan=payload.pan_number,
        extracted_name=payload.name_on_pan,
        dob_or_incorporation=payload.dob_or_incorporation,
        extraction_confidence=0.95
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="VERIFY_PAN_IDENTITY",
        resource_type="identity_verification",
        resource_id=str(record.id),
        details={
            "masked_pan": record.masked_id,
            "format_valid": record.format_valid,
            "external_status": record.external_verification_status
        }
    )

    return to_identity_response(record)

@router.post("/verify-aadhaar", response_model=IdentityVerificationResponse)
def verify_aadhaar_endpoint(
    payload: AadhaarVerificationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits and verifies Aadhaar with mandatory informed consent and strict masking.
    Never stores raw 12 digits. Never claims external authenticity if unconfigured.
    """
    if not payload.consent_obtained:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informed applicant consent is legally mandatory prior to processing Aadhaar identification."
        )

    if payload.business_id:
        bus = db.query(models.Business).filter(models.Business.id == payload.business_id).first()
        if not bus or (bus.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized business access.")

    engine = IdentityVerificationEngine(db)
    try:
        record = engine.verify_aadhaar_document(
            user_id=current_user.uid,
            business_id=payload.business_id,
            document_id=payload.document_id,
            extracted_aadhaar_raw=payload.aadhaar_number,
            extracted_name=payload.name_on_aadhaar,
            dob=payload.dob,
            consent_obtained=payload.consent_obtained,
            extraction_confidence=0.92
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="VERIFY_AADHAAR_IDENTITY",
        resource_type="identity_verification",
        resource_id=str(record.id),
        details={
            "masked_aadhaar": record.masked_id,
            "consent_obtained": True,
            "format_valid": record.format_valid
        }
    )

    return to_identity_response(record)

@router.get("/status", response_model=IdentityStatusResponse)
def get_identity_status(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves unified identity verification checks for PAN and Aadhaar.
    Accessible by owner or authorized credit risk analysts/admins.
    """
    lookup_uid = current_user.uid
    if target_user_id and target_user_id != current_user.uid:
        if current_user.role not in ["analyst", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access to applicant identity status.")
        lookup_uid = target_user_id

    records = db.query(models.IdentityVerification).filter(models.IdentityVerification.user_id == lookup_uid).all()

    pan_record = next((r for r in records if r.id_type == "PAN"), None)
    aadhaar_record = next((r for r in records if r.id_type == "AADHAAR"), None)

    all_verified = bool(
        pan_record and pan_record.manual_review_status == "COMPLETED_APPROVED" and
        (not aadhaar_record or aadhaar_record.manual_review_status == "COMPLETED_APPROVED")
    )
    requires_manual = not all_verified

    pan_resp = to_identity_response(pan_record) if pan_record else None
    aadhaar_resp = to_identity_response(aadhaar_record) if aadhaar_record else None

    summary_parts = []
    if pan_record:
        summary_parts.append(f"PAN: {pan_record.masked_id} (Format: {'Valid' if pan_record.format_valid else 'Invalid'}, Match: {'Yes' if pan_record.declared_name_match else 'No'}, Review: {pan_record.manual_review_status})")
    else:
        summary_parts.append("PAN: Not Submitted")

    if aadhaar_record:
        summary_parts.append(f"Aadhaar: {aadhaar_record.masked_id} (Consent: Obtained, Format: {'Valid' if aadhaar_record.format_valid else 'Invalid'}, Review: {aadhaar_record.manual_review_status})")
    else:
        summary_parts.append("Aadhaar: Optional / Not Submitted")

    return IdentityStatusResponse(
        pan_verification=pan_resp,
        aadhaar_verification=aadhaar_resp,
        all_identities_verified=all_verified,
        requires_manual_review=requires_manual,
        summary="; ".join(summary_parts)
    )

@router.post("/{id}/analyst-review", response_model=IdentityVerificationResponse)
def submit_analyst_identity_review_endpoint(
    id: int,
    payload: AnalystIdentityReviewRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records human underwriter review decision on an identity verification record.
    Restricted to analyst and admin roles.
    """
    if current_user.role not in ["analyst", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only credit risk analysts and administrators can record identity review decisions."
        )

    engine = IdentityVerificationEngine(db)
    try:
        record = engine.submit_analyst_identity_review(
            verification_id=id,
            analyst_uid=current_user.uid,
            decision=payload.decision,
            notes=payload.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return to_identity_response(record)
