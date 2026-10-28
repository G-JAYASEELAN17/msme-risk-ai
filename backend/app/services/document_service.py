import os
import io
import hashlib
import datetime
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..database import models
from .storage_service import storage_service
from .extraction_service import run_document_extraction, parse_financial_number
from .verification_service import verification_engine
from .audit_service import log_audit_event

logger = logging.getLogger("document_service")

class DocumentService:
    """
    Core orchestrator for financial document intelligence, extraction,
    verification, and safe integration into credit assessments.
    """

    @staticmethod
    def process_document(
        document_id: int,
        user_id: str,
        db: Session,
        file_bytes: Optional[bytes] = None
    ) -> models.Document:
        """
        Executes document intelligence & verification pipeline:
        1. Reads file bytes from storage or memory.
        2. Computes SHA-256 hash for integrity and duplicate tracking.
        3. Performs classification & field extraction.
        4. Runs multi-check Verification Engine (arithmetic, cross-doc, external registry).
        5. Persists normalized fields into PostgreSQL with audit tracking.
        """
        doc = db.query(models.Document).filter(
            models.Document.id == document_id,
            models.Document.user_id == user_id
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        doc.processing_status = "PROCESSING"
        doc.error_message = None
        db.commit()

        try:
            # 1. Retrieve bytes if not in memory
            if file_bytes is None:
                file_bytes = storage_service.get_file_bytes_sync(doc.user_id, doc.file_path)
                if file_bytes is None:
                    raise ValueError("File content could not be retrieved from storage.")

            # 2. Calculate SHA-256 file hash
            file_hash = hashlib.sha256(file_bytes).hexdigest()
            doc.file_hash = file_hash

            # 3. Run extraction pipeline
            type_hint = doc.document_type if doc.document_type and doc.document_type != "OTHER" else None
            extraction_result = run_document_extraction(
                file_bytes=file_bytes,
                filename=doc.original_filename,
                mime_type=doc.mime_type,
                document_type_hint=type_hint
            )

            # 4. Update document metadata
            doc.document_type = extraction_result.document_type
            doc.status = "processed"

            # 5. Clear old fields if re-processing
            db.query(models.ExtractedField).filter(
                models.ExtractedField.document_id == doc.id
            ).delete()

            # 6. Populate ExtractedField rows
            fields_dict: Dict[str, Any] = {}
            for field_name, f_data in extraction_result.fields.items():
                if f_data.normalized_value is not None or f_data.string_value is not None:
                    db_field = models.ExtractedField(
                        document_id=doc.id,
                        field_name=field_name,
                        raw_value=f_data.raw_value,
                        normalized_value=f_data.normalized_value,
                        string_value=f_data.string_value,
                        confidence=f_data.confidence,
                        source_page=f_data.source_page,
                        extraction_method=f_data.extraction_method,
                        is_verified=False,
                        is_manually_edited=False
                    )
                    db.add(db_field)
                    fields_dict[field_name] = {
                        "value": f_data.normalized_value if f_data.normalized_value is not None else f_data.string_value,
                        "confidence": f_data.confidence,
                        "source_page": f_data.source_page,
                        "method": f_data.extraction_method,
                        "verified": False
                    }

            doc.extracted_data = {
                "overall_confidence": extraction_result.overall_confidence,
                "document_type": extraction_result.document_type,
                "page_count": extraction_result.page_count,
                "is_scanned": extraction_result.is_scanned,
                "extraction_method": extraction_result.extraction_method,
                "fields": fields_dict
            }
            db.commit()
            db.refresh(doc)

            # 7. Run Verification Engine
            ver_report = verification_engine.run_verification(
                document=doc,
                db=db,
                file_bytes=file_bytes
            )
            doc.processing_status = ver_report.overall_status

            # Auto-sync identity verification if PAN is extracted or document is PAN_CARD
            extracted_pan = fields_dict.get("pan", {}).get("value")
            extracted_name = fields_dict.get("business_name", {}).get("value") or fields_dict.get("account_holder", {}).get("value")
            dob_val = fields_dict.get("dob", {}).get("value")
            if (doc.document_type == "PAN_CARD" or extracted_pan) and extracted_pan:
                try:
                    from .identity_service import IdentityVerificationEngine
                    id_engine = IdentityVerificationEngine(db)
                    id_engine.verify_pan_document(
                        user_id=user_id,
                        business_id=doc.business_id,
                        document_id=doc.id,
                        extracted_pan=str(extracted_pan),
                        extracted_name=str(extracted_name) if extracted_name else None,
                        dob_or_incorporation=str(dob_val) if dob_val else None,
                        extraction_confidence=extraction_result.overall_confidence
                    )
                except Exception as e:
                    logger.warning(f"Auto-sync identity verification for PAN skipped: {e}")

            # 8. Audit log & notification
            log_audit_event(
                db=db,
                user_id=user_id,
                action="DOCUMENT_EXTRACTION_AND_VERIFICATION_COMPLETED",
                resource_type="document",
                resource_id=str(doc.id),
                details={
                    "document_type": doc.document_type,
                    "fields_extracted": len(fields_dict),
                    "confidence": extraction_result.overall_confidence,
                    "verification_status": doc.processing_status,
                    "discrepancies_count": len(ver_report.discrepancies)
                }
            )

            # Create in-app notification
            status_text = "Verified" if doc.processing_status == "VERIFIED" else "Ready for Review"
            notification = models.Notification(
                user_id=user_id,
                title=f"Document {status_text}",
                message=f"Analysis completed for '{doc.original_filename}'. Status: {doc.processing_status}. {ver_report.explanation}",
                type="success" if doc.processing_status == "VERIFIED" else "warning" if "MISMATCH" in doc.processing_status else "info",
                is_read=False,
                link=f"/documents"
            )
            db.add(notification)
            db.commit()

            return doc

        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}", exc_info=True)
            doc.processing_status = "PROCESSING_FAILED"
            doc.error_message = str(e)
            doc.status = "error"
            db.commit()

            log_audit_event(
                db=db,
                user_id=user_id,
                action="DOCUMENT_EXTRACTION_FAILED",
                resource_type="document",
                resource_id=str(doc.id),
                details={"error": str(e)}
            )
            return doc

    @staticmethod
    def update_field(
        document_id: int,
        field_id: int,
        user_id: str,
        value: Any,
        db: Session
    ) -> models.ExtractedField:
        """
        Manually corrects an extracted field.
        Safety guarantee: preserves original raw_value and extraction confidence,
        recording manual correction audit metadata.
        """
        doc = db.query(models.Document).filter(
            models.Document.id == document_id,
            models.Document.user_id == user_id
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        field = db.query(models.ExtractedField).filter(
            models.ExtractedField.id == field_id,
            models.ExtractedField.document_id == document_id
        ).first()
        if not field:
            raise HTTPException(status_code=404, detail="Extracted field not found.")

        # Update field with manual correction tracking
        val_str = str(value).strip()
        num_val = parse_financial_number(val_str)

        old_val = field.verified_value or field.string_value or str(field.normalized_value)
        field.is_manually_edited = True
        field.is_verified = True
        field.verified_value = val_str
        field.verified_by = user_id
        field.verified_at = datetime.datetime.utcnow()

        if num_val is not None:
            field.normalized_value = num_val
            field.string_value = str(num_val)
        else:
            field.string_value = val_str

        # Update cached extracted_data on document
        if doc.extracted_data and "fields" in doc.extracted_data:
            f_map = dict(doc.extracted_data["fields"])
            if field.field_name in f_map:
                f_map[field.field_name]["value"] = field.normalized_value if field.normalized_value is not None else field.string_value
                f_map[field.field_name]["verified"] = True
                f_map[field.field_name]["manually_edited"] = True
                doc.extracted_data["fields"] = f_map

        db.commit()
        db.refresh(field)

        # Re-run verification engine with updated field data
        try:
            ver_report = verification_engine.run_verification(
                document=doc,
                db=db
            )
            doc.processing_status = ver_report.overall_status
            db.commit()
            db.refresh(doc)
        except Exception as e:
            logger.warning(f"Verification re-run after field edit failed: {e}")

        log_audit_event(
            db=db,
            user_id=user_id,
            action="DOCUMENT_FIELD_EDITED",
            resource_type="document",
            resource_id=str(doc.id),
            details={
                "field_name": field.field_name,
                "old_value": old_val,
                "new_value": val_str,
                "verified_by": user_id
            }
        )

        return field

    @staticmethod
    def submit_analyst_review(
        document_id: int,
        analyst_user: models.User,
        decision: str,  # APPROVED | REJECTED | INVESTIGATION_REQUIRED | NEEDS_DOCUMENTS
        notes: Optional[str],
        db: Session
    ) -> models.Document:
        """
        Records human risk analyst decision on a financial document.
        APPROVED: Marks document as VERIFIED by underwriter policy.
        REJECTED: Rejects document authenticity/validity.
        INVESTIGATION_REQUIRED: Flags document for forensic audit.
        NEEDS_DOCUMENTS: Asks applicant for additional supporting evidence.
        """
        doc = db.query(models.Document).filter(
            models.Document.id == document_id
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        valid_decisions = ["APPROVED", "REJECTED", "INVESTIGATION_REQUIRED", "NEEDS_DOCUMENTS"]
        decision_upper = decision.upper().strip()
        if decision_upper not in valid_decisions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid decision '{decision}'. Allowed: {', '.join(valid_decisions)}"
            )

        now = datetime.datetime.utcnow()
        doc.analyst_decision = decision_upper
        doc.analyst_notes = notes.strip() if notes else None
        doc.reviewed_by = analyst_user.uid
        doc.reviewed_at = now

        if decision_upper == "APPROVED":
            doc.processing_status = "VERIFIED"
            doc.status = "verified"
            # Mark extracted fields as analyst-verified
            for f in doc.fields:
                f.is_verified = True
                f.verified_by = analyst_user.uid
                f.verified_at = now
                if not f.verified_value:
                    f.verified_value = str(f.normalized_value if f.normalized_value is not None else f.string_value)
        elif decision_upper == "REJECTED":
            doc.processing_status = "MISMATCH_FOUND"
            doc.status = "error"
        else:
            doc.processing_status = "MANUAL_REVIEW_REQUIRED"

        # Re-run verification report generation with analyst decision reflected
        ver_report = verification_engine.run_verification(document=doc, db=db)
        if decision_upper == "APPROVED":
            doc.processing_status = "VERIFIED"
            doc.status = "verified"

        db.commit()
        db.refresh(doc)

        log_audit_event(
            db=db,
            user_id=analyst_user.uid,
            action="ANALYST_DOCUMENT_REVIEW",
            resource_type="document",
            resource_id=str(doc.id),
            details={
                "decision": decision_upper,
                "notes": notes,
                "analyst_id": analyst_user.uid,
                "document_owner": doc.user_id
            }
        )

        # Notify document owner
        notif_msg = f"Your document '{doc.original_filename}' review decision: {decision_upper}."
        if notes:
            notif_msg += f" Note: {notes}"
        notif = models.Notification(
            user_id=doc.user_id,
            title=f"Document Review: {decision_upper.title().replace('_', ' ')}",
            message=notif_msg,
            type="success" if decision_upper == "APPROVED" else "warning" if decision_upper == "REJECTED" else "info",
            is_read=False,
            link="/documents"
        )
        db.add(notif)
        db.commit()

        return doc

    @staticmethod
    def retry_verification(
        document_id: int,
        user_id: str,
        db: Session
    ) -> models.Document:
        """
        Retries or re-evaluates verification engine on an existing document.
        Does not leave record stuck in 'Processing'.
        """
        doc = db.query(models.Document).filter(
            models.Document.id == document_id
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        return DocumentService.process_document(
            document_id=doc.id,
            user_id=doc.user_id,
            db=db
        )


    @staticmethod
    def verify_all_fields(
        document_id: int,
        user_id: str,
        db: Session
    ) -> models.Document:
        """
        Marks all extracted fields as user-verified.
        Transitions document processing_status to 'VERIFIED'.
        """
        doc = db.query(models.Document).filter(
            models.Document.id == document_id,
            models.Document.user_id == user_id
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        now = datetime.datetime.utcnow()
        fields = db.query(models.ExtractedField).filter(
            models.ExtractedField.document_id == document_id
        ).all()

        for f in fields:
            f.is_verified = True
            f.verified_by = user_id
            f.verified_at = now
            if not f.verified_value:
                f.verified_value = str(f.normalized_value if f.normalized_value is not None else f.string_value)

        doc.processing_status = "VERIFIED"
        doc.status = "verified"

        # Update cache
        if doc.extracted_data and "fields" in doc.extracted_data:
            f_map = dict(doc.extracted_data["fields"])
            for fname in f_map:
                f_map[fname]["verified"] = True
            doc.extracted_data["fields"] = f_map

        db.commit()
        db.refresh(doc)

        log_audit_event(
            db=db,
            user_id=user_id,
            action="DOCUMENT_VERIFIED",
            resource_type="document",
            resource_id=str(doc.id),
            details={"field_count": len(fields)}
        )

        return doc

    @staticmethod
    def get_assessment_payload(
        document_id: int,
        user_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Extracts verified financial data for populating credit assessment input.
        Enforces safety principle: only user-verified fields may be transferred.
        """
        doc = db.query(models.Document).filter(
            models.Document.id == document_id,
            models.Document.user_id == user_id
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        fields = db.query(models.ExtractedField).filter(
            models.ExtractedField.document_id == document_id
        ).all()

        # Check which verified fields exist
        verified_data: Dict[str, Any] = {}
        for f in fields:
            if f.is_verified:
                val = f.normalized_value if f.normalized_value is not None else f.string_value
                verified_data[f.field_name] = val

        # Map to assessment fields
        assessment_fields = {
            "annual_revenue": verified_data.get("annual_revenue"),
            "monthly_cash_flow": verified_data.get("monthly_cash_flow"),
            "monthly_expenses": verified_data.get("monthly_expenses"),
            "existing_debt": verified_data.get("existing_debt", 0.0),
            "digital_transactions": int(verified_data.get("digital_transactions", 50)),
            "utility_payment_score": float(verified_data.get("utility_payment_score", 85.0)),
            "invoice_payment_score": float(verified_data.get("invoice_payment_score", 85.0)),
            "previous_defaults": int(verified_data.get("previous_defaults", 0))
        }

        # Check required fields
        required_fields = ["annual_revenue", "monthly_cash_flow", "monthly_expenses"]
        missing = [rf for rf in required_fields if assessment_fields.get(rf) is None]

        return {
            "document_id": doc.id,
            "document_name": doc.original_filename,
            "document_type": doc.document_type,
            "is_fully_verified": doc.processing_status == "VERIFIED",
            "verified_fields": verified_data,
            "assessment_input": assessment_fields,
            "missing_required_fields": missing,
            "can_use_in_assessment": len(missing) == 0,
            "warning": "Additional financial information is required before risk assessment." if missing else None
        }

document_service = DocumentService()
