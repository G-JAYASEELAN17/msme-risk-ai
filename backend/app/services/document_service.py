import os
import datetime
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..database import models
from .storage_service import storage_service
from .extraction_service import run_document_extraction, parse_financial_number
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
        Executes document intelligence pipeline:
        1. Reads file bytes from storage if not provided.
        2. Performs classification & field extraction.
        3. Persists normalized fields into PostgreSQL with full audit tracking.
        4. Notifies user that human review is required.
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
                local_path = storage_service.get_local_path(doc.file_path)
                if local_path and local_path.is_file():
                    with open(local_path, "rb") as f:
                        file_bytes = f.read()
                else:
                    raise ValueError("File content could not be retrieved from storage.")

            # 2. Run extraction pipeline
            type_hint = doc.document_type if doc.document_type and doc.document_type != "OTHER" else None
            extraction_result = run_document_extraction(
                file_bytes=file_bytes,
                filename=doc.original_filename,
                mime_type=doc.mime_type,
                document_type_hint=type_hint
            )

            # 3. Update document metadata
            doc.document_type = extraction_result.document_type
            doc.processing_status = "REVIEW_REQUIRED"
            doc.status = "processed"

            # 4. Clear old fields if re-processing
            db.query(models.ExtractedField).filter(
                models.ExtractedField.document_id == doc.id
            ).delete()

            # 5. Populate ExtractedField rows
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

            # 6. Audit log & notification
            log_audit_event(
                db=db,
                user_id=user_id,
                action="DOCUMENT_EXTRACTION_COMPLETED",
                resource_type="document",
                resource_id=str(doc.id),
                details={
                    "document_type": doc.document_type,
                    "fields_extracted": len(fields_dict),
                    "confidence": extraction_result.overall_confidence
                }
            )

            # Create in-app notification
            notification = models.Notification(
                user_id=user_id,
                title="Document Ready for Review",
                message=f"Financial extraction completed for '{doc.original_filename}'. Please verify values before using in an assessment.",
                type="info",
                is_read=False,
                link=f"/documents"
            )
            db.add(notification)
            db.commit()

            return doc

        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}", exc_info=True)
            doc.processing_status = "FAILED"
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
