from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from ..database import models

# Configurable Document Categories
REQUIRED_CHECKLIST_SPECS = [
    {
        "category_key": "PAN_CARD",
        "category_name": "PAN Card",
        "subtitle": "Identity & Entity Verification",
        "description": "Permanent Account Number card of applicant or enterprise for statutory identity validation.",
        "accepted_formats": "PDF, PNG, JPG, JPEG (Max 10MB)",
        "is_required": True,
        "can_exemption": False,
        "allow_multiple": False,
        "matching_types": ["PAN_CARD"],
    },
    {
        "category_key": "BUSINESS_REGISTRATION",
        "category_name": "Business Registration",
        "subtitle": "Udyam or Incorporated Proof",
        "description": "Udyam registration certificate, Certificate of Incorporation, Shop & Establishment license, or Partnership deed.",
        "accepted_formats": "PDF, PNG, JPG (Max 10MB)",
        "is_required": True,
        "can_exemption": True,
        "allow_multiple": False,
        "matching_types": ["BUSINESS_REGISTRATION"],
    },
    {
        "category_key": "BANK_STATEMENT",
        "category_name": "Bank Statements",
        "subtitle": "Last 6 Months (Multi-Account Supported)",
        "description": "Official 6-month operational bank statements. Supports multiple business accounts (Current, CC, OD).",
        "accepted_formats": "PDF, CSV, XLSX (Max 10MB)",
        "is_required": True,
        "can_exemption": False,
        "allow_multiple": True,
        "matching_types": ["BANK_STATEMENT"],
    },
    {
        "category_key": "GST_DOCUMENT",
        "category_name": "GST Returns",
        "subtitle": "Latest 6 Months (Where Applicable)",
        "description": "GSTR-3B monthly summary filings or GSTR-1 for the latest 6 months.",
        "accepted_formats": "PDF, JSON, Excel (Max 10MB)",
        "is_required": True,
        "can_exemption": True,
        "allow_multiple": True,
        "matching_types": ["GST_DOCUMENT"],
    },
    {
        "category_key": "FINANCIAL_STATEMENTS",
        "category_name": "Income Tax Return / Financial Statements",
        "subtitle": "Latest Filing or Accepted Statements",
        "description": "Latest ITR-V acknowledgment or Audited Balance Sheet and Profit & Loss statements.",
        "accepted_formats": "PDF, Excel (Max 10MB)",
        "is_required": True,
        "can_exemption": True,
        "allow_multiple": True,
        "matching_types": ["FINANCIAL_STATEMENTS", "PROFIT_LOSS", "BALANCE_SHEET", "INCOME_STATEMENT"],
    },
]

# Optional Additional Supporting Documents Specs
ADDITIONAL_DOCUMENT_SPECS = [
    {
        "category_key": "INVOICE",
        "category_name": "Commercial Invoices",
        "subtitle": "Client & Vendor Proof",
        "description": "Sample sales invoices or purchase orders to establish customer relationship strength.",
        "accepted_formats": "PDF, PNG, JPG (Max 10MB)",
        "matching_types": ["INVOICE"],
    },
    {
        "category_key": "UTILITY_BILL",
        "category_name": "Utility Bills",
        "subtitle": "Address & Operational Stability",
        "description": "Electricity, water, or commercial piped gas bills for operational stability verification.",
        "accepted_formats": "PDF, PNG, JPG (Max 10MB)",
        "matching_types": ["UTILITY_BILL"],
    },
    {
        "category_key": "LOAN_STATEMENT",
        "category_name": "Loan Sanction Letters & Debt Statements",
        "subtitle": "Existing Liability Records",
        "description": "Sanction letters, debt schedules, or repayment statements for existing loans.",
        "accepted_formats": "PDF (Max 10MB)",
        "matching_types": ["LOAN_STATEMENT"],
    },
    {
        "category_key": "OTHER",
        "category_name": "Other Relevant Records",
        "subtitle": "Supplementary Underwriting Evidence",
        "description": "Any additional trade licenses, certifications, awards, or collateral documentation.",
        "accepted_formats": "PDF, PNG, JPG, Excel (Max 10MB)",
        "matching_types": ["OTHER"],
    },
]

class ChecklistService:
    @staticmethod
    def get_document_checklist(user_id: str, business_id: Optional[int], db: Session) -> Dict[str, Any]:
        """
        Computes the complete document checklist status for an MSME applicant.
        Evaluates the 5 required categories and optional additional records.
        """
        # Fetch user documents
        doc_query = db.query(models.Document).filter(models.Document.user_id == user_id)
        if business_id:
            doc_query = doc_query.filter(
                (models.Document.business_id == business_id) | (models.Document.business_id.is_(None))
            )
        all_docs = doc_query.order_by(models.Document.created_at.desc()).all()

        # Fetch exemptions
        exemption_query = db.query(models.DocumentExemption).filter(models.DocumentExemption.user_id == user_id)
        if business_id:
            exemption_query = exemption_query.filter(
                (models.DocumentExemption.business_id == business_id) | (models.DocumentExemption.business_id.is_(None))
            )
        exemptions = {e.category: e for e in exemption_query.all()}

        # Fetch identity records (e.g. PAN verified through Identity API)
        id_query = db.query(models.IdentityVerification).filter(models.IdentityVerification.user_id == user_id)
        if business_id:
            id_query = id_query.filter(
                (models.IdentityVerification.business_id == business_id) | (models.IdentityVerification.business_id.is_(None))
            )
        id_records = {r.id_type: r for r in id_query.all()}

        # Fetch bank accounts
        ba_query = db.query(models.BankAccount).filter(models.BankAccount.user_id == user_id)
        if business_id:
            ba_query = ba_query.filter(
                (models.BankAccount.business_id == business_id) | (models.BankAccount.business_id.is_(None))
            )
        bank_accounts = ba_query.all()

        checklist_items = []
        satisfied_count = 0
        blocking_reasons = []

        for spec in REQUIRED_CHECKLIST_SPECS:
            cat_key = spec["category_key"]
            matching_types = spec["matching_types"]

            # Filter documents belonging to this category
            cat_docs = [d for d in all_docs if (d.document_type or "OTHER") in matching_types]

            exemption = exemptions.get(cat_key)
            is_exempt = exemption is not None and exemption.status in ["APPROVED", "PENDING_REVIEW"]
            exemption_reason = exemption.reason if exemption else None

            # Check special sources
            has_identity_record = (cat_key == "PAN_CARD" and "PAN" in id_records)
            has_bank_statement_source = (cat_key == "BANK_STATEMENT" and any(b.statement_uploaded for b in bank_accounts))

            has_valid_docs = len(cat_docs) > 0 or has_identity_record or has_bank_statement_source
            is_satisfied = has_valid_docs or is_exempt

            # Compute category status
            if is_exempt:
                cat_status = "EXEMPT"
            elif not has_valid_docs:
                cat_status = "NOT_UPLOADED"
            else:
                # Check document processing statuses
                statuses = [d.processing_status for d in cat_docs]
                if any(s == "MISMATCH_FOUND" for s in statuses):
                    cat_status = "MISMATCH_FOUND"
                elif any(s in ["MANUAL_REVIEW_REQUIRED", "REVIEW_REQUIRED"] for s in statuses):
                    cat_status = "MANUAL_REVIEW_REQUIRED"
                elif any(s == "PROCESSING" for s in statuses):
                    cat_status = "PROCESSING"
                elif all(s == "VERIFIED" for s in statuses) and len(statuses) > 0:
                    cat_status = "VERIFIED"
                else:
                    cat_status = "UPLOADED"

            if is_satisfied:
                satisfied_count += 1
            else:
                blocking_reasons.append(f"Missing required document: {spec['category_name']} ({spec['subtitle']})")

            # Format documents metadata
            doc_summaries = []
            for d in cat_docs:
                is_duplicate = bool(d.verification_report and isinstance(d.verification_report, dict) and d.verification_report.get("is_duplicate_file"))
                dup_info = d.verification_report.get("duplicate_with") if (d.verification_report and isinstance(d.verification_report, dict)) else None
                doc_summaries.append({
                    "id": d.id,
                    "filename": d.original_filename or d.filename,
                    "file_size": d.file_size,
                    "mime_type": d.mime_type,
                    "document_type": d.document_type,
                    "processing_status": d.processing_status,
                    "error_message": d.error_message,
                    "file_hash": d.file_hash,
                    "is_duplicate": is_duplicate,
                    "duplicate_info": dup_info,
                    "download_url": f"/api/documents/{d.id}/download",
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                })

            checklist_items.append({
                "category_key": cat_key,
                "category_name": spec["category_name"],
                "subtitle": spec["subtitle"],
                "description": spec["description"],
                "accepted_formats": spec["accepted_formats"],
                "is_required": spec["is_required"],
                "can_exemption": spec["can_exemption"],
                "allow_multiple": spec["allow_multiple"],
                "is_exempt": is_exempt,
                "exemption_reason": exemption_reason,
                "is_satisfied": is_satisfied,
                "status": cat_status,
                "documents": doc_summaries,
                "total_documents_count": len(doc_summaries),
            })

        # Additional Documents Section
        additional_items = []
        for spec in ADDITIONAL_DOCUMENT_SPECS:
            cat_key = spec["category_key"]
            matching_types = spec["matching_types"]
            cat_docs = [d for d in all_docs if (d.document_type or "OTHER") in matching_types]

            doc_summaries = []
            for d in cat_docs:
                is_duplicate = bool(d.verification_report and isinstance(d.verification_report, dict) and d.verification_report.get("is_duplicate_file"))
                dup_info = d.verification_report.get("duplicate_with") if (d.verification_report and isinstance(d.verification_report, dict)) else None
                doc_summaries.append({
                    "id": d.id,
                    "filename": d.original_filename or d.filename,
                    "file_size": d.file_size,
                    "mime_type": d.mime_type,
                    "document_type": d.document_type,
                    "processing_status": d.processing_status,
                    "file_hash": d.file_hash,
                    "is_duplicate": is_duplicate,
                    "duplicate_info": dup_info,
                    "download_url": f"/api/documents/{d.id}/download",
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                })

            additional_items.append({
                "category_key": cat_key,
                "category_name": spec["category_name"],
                "subtitle": spec["subtitle"],
                "description": spec["description"],
                "accepted_formats": spec["accepted_formats"],
                "is_required": False,
                "documents": doc_summaries,
                "total_documents_count": len(doc_summaries),
            })

        total_required = len(REQUIRED_CHECKLIST_SPECS)
        progress_percentage = round((satisfied_count / total_required) * 100) if total_required > 0 else 100
        can_submit_assessment = (satisfied_count >= total_required)

        return {
            "required_categories_total": total_required,
            "satisfied_categories_count": satisfied_count,
            "progress_percentage": progress_percentage,
            "progress_label": f"{satisfied_count} of {total_required} required categories complete",
            "can_submit_assessment": can_submit_assessment,
            "blocking_reasons": blocking_reasons,
            "checklist": checklist_items,
            "additional_documents": additional_items,
        }

    @staticmethod
    def apply_exemption(user_id: str, business_id: Optional[int], category: str, reason: str, db: Session) -> models.DocumentExemption:
        """
        Records an explicit, auditable exemption for a checklist category.
        """
        valid_exemptible_categories = {"GST_DOCUMENT", "BUSINESS_REGISTRATION", "FINANCIAL_STATEMENTS"}
        if category not in valid_exemptible_categories:
            raise ValueError(f"Category '{category}' is not eligible for exemption under statutory lending policy.")

        # Check existing exemption
        existing = db.query(models.DocumentExemption).filter(
            models.DocumentExemption.user_id == user_id,
            models.DocumentExemption.category == category
        ).first()

        if existing:
            existing.reason = reason
            existing.business_id = business_id
            existing.status = "APPROVED"
            db.commit()
            db.refresh(existing)
            return existing

        exemption = models.DocumentExemption(
            user_id=user_id,
            business_id=business_id,
            category=category,
            reason=reason,
            status="APPROVED",
        )
        db.add(exemption)
        db.commit()
        db.refresh(exemption)
        return exemption

    @staticmethod
    def remove_exemption(user_id: str, category: str, db: Session) -> bool:
        """Removes an exemption to restore category requirement."""
        existing = db.query(models.DocumentExemption).filter(
            models.DocumentExemption.user_id == user_id,
            models.DocumentExemption.category == category
        ).first()
        if existing:
            db.delete(existing)
            db.commit()
            return True
        return False

checklist_service = ChecklistService()
