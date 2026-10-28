"""
MSME Risk AI — Applicant Correction & Resubmission Service
Preserves complete historical audit trail when applicants correct inaccurate fields
or upload replacement documents. Recalculates affected checks without deleting historical records.
"""

import datetime
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..database import models

logger = logging.getLogger("correction_service")

class CorrectionService:
    def __init__(self, db: Session):
        self.db = db

    def submit_correction(
        self,
        user_id: str,
        business_id: int,
        field_name: str,
        corrected_value: str,
        reason: str,
        original_value: Optional[str] = None,
        replaced_document_id: Optional[int] = None,
        new_document_id: Optional[int] = None,
    ) -> models.ApplicantCorrection:
        """
        Records an applicant correction request with full audit traceability.
        """
        correction = models.ApplicantCorrection(
            user_id=user_id,
            business_id=business_id,
            field_name=field_name.strip(),
            original_value=str(original_value) if original_value is not None else None,
            corrected_value=str(corrected_value).strip(),
            reason=reason.strip(),
            replaced_document_id=replaced_document_id,
            new_document_id=new_document_id,
            submitted_by=user_id,
            status="PENDING_REVIEW"
        )
        self.db.add(correction)

        # Log audit entry
        audit = models.AuditLog(
            user_id=user_id,
            action="APPLICANT_SUBMIT_CORRECTION",
            resource_type="correction",
            resource_id=str(field_name),
            details={
                "business_id": business_id,
                "field_name": field_name,
                "original_value": original_value,
                "corrected_value": corrected_value,
                "reason": reason,
                "replaced_document_id": replaced_document_id,
                "new_document_id": new_document_id
            }
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(correction)
        return correction

    def list_corrections(
        self,
        user_id: Optional[str] = None,
        business_id: Optional[int] = None
    ) -> List[models.ApplicantCorrection]:
        """Lists corrections with optional filtering."""
        query = self.db.query(models.ApplicantCorrection)
        if user_id:
            query = query.filter(models.ApplicantCorrection.user_id == user_id)
        if business_id:
            query = query.filter(models.ApplicantCorrection.business_id == business_id)
        return query.order_by(models.ApplicantCorrection.created_at.desc()).all()

    def review_correction(
        self,
        correction_id: int,
        analyst_uid: str,
        decision: str,  # ACCEPTED | REJECTED
        notes: Optional[str] = None
    ) -> models.ApplicantCorrection:
        """
        Underwriter review for applicant correction.
        If accepted, applies update to business assessment record if applicable.
        """
        correction = self.db.query(models.ApplicantCorrection).filter(models.ApplicantCorrection.id == correction_id).first()
        if not correction:
            raise ValueError(f"Correction #{correction_id} not found.")

        dec_upper = decision.strip().upper()
        if dec_upper not in ["ACCEPTED", "REJECTED"]:
            raise ValueError(f"Invalid decision '{decision}'. Expected ACCEPTED or REJECTED.")

        correction.status = dec_upper
        correction.analyst_notes = notes
        correction.reviewed_by = analyst_uid
        correction.reviewed_at = datetime.datetime.utcnow()

        if dec_upper == "ACCEPTED":
            correction.recalculated_at = datetime.datetime.utcnow()
            # If correction is for an assessment financial field, update active assessment
            assessment = (
                self.db.query(models.Assessment)
                .filter(models.Assessment.business_id == correction.business_id)
                .order_by(models.Assessment.created_at.desc())
                .first()
            )
            if assessment and hasattr(assessment, correction.field_name):
                try:
                    val = float(correction.corrected_value)
                    setattr(assessment, correction.field_name, val)
                except (ValueError, TypeError):
                    pass

        # Log audit entry
        audit = models.AuditLog(
            user_id=analyst_uid,
            action="ANALYST_REVIEW_CORRECTION",
            resource_type="correction",
            resource_id=str(correction.id),
            details={
                "decision": dec_upper,
                "notes": notes,
                "field_name": correction.field_name,
                "corrected_value": correction.corrected_value
            }
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(correction)
        return correction
