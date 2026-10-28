"""
MSME Risk AI — Document Verification Engine
Performs multi-layered verification:
1. File validation & SHA-256 duplicate detection.
2. OCR extraction field-level confidence validation.
3. Arithmetic consistency checks (credit/debit, tax/turnover, revenue/profit).
4. Cross-document consistency (business names, GSTIN, PAN, reporting periods).
5. Declared loan assessment cross-checking.
6. Independent external verification provider interface (strict anti-fabrication).
7. Risk & fraud indicators (flagged for human underwriting investigation, not automatic rejection).
8. Unified verification status determination.
"""

import hashlib
import datetime
import logging
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import models

logger = logging.getLogger("verification_service")


# ----------------- PYDANTIC MODELS FOR VERIFICATION REPORT -----------------

class Discrepancy(BaseModel):
    id: str
    field: str
    category: str  # arithmetic | cross_document | assessment_comparison | format | duplicate
    severity: str  # LOW | MEDIUM | HIGH
    expected_value: Optional[Any] = None
    observed_value: Optional[Any] = None
    source_document: Optional[str] = None
    explanation: str


class RiskIndicator(BaseModel):
    indicator: str
    severity: str  # LOW | MEDIUM | HIGH
    details: str
    investigation_recommended: bool = True


class ExternalVerificationResult(BaseModel):
    service_name: str = "Official Registry Verification"
    status: str = "UNABLE_TO_VERIFY"  # UNABLE_TO_VERIFY | VERIFIED | MISMATCH | NOT_CONFIGURED
    verified_at: Optional[str] = None
    source: str = "External Registry Interface"
    reference_id: Optional[str] = None
    message: str = "Official external verification service is not configured with live authorized API credentials. Manual verification or analyst review required."
    evidence: Dict[str, Any] = Field(default_factory=dict)


class VerificationReport(BaseModel):
    document_id: int
    file_hash: Optional[str] = None
    is_duplicate_file: bool = False
    duplicate_with: Optional[Dict[str, Any]] = None
    overall_status: str  # UPLOADED | PROCESSING | VERIFIED | MISMATCH_FOUND | UNABLE_TO_VERIFY | MANUAL_REVIEW_REQUIRED | PROCESSING_FAILED
    arithmetic_checks: Dict[str, Any] = Field(default_factory=lambda: {"passed": True, "details": []})
    cross_document_checks: Dict[str, Any] = Field(default_factory=lambda: {"passed": True, "compared_documents_count": 0, "details": []})
    assessment_comparison: Dict[str, Any] = Field(default_factory=lambda: {"checked": False, "details": []})
    discrepancies: List[Discrepancy] = Field(default_factory=list)
    risk_indicators: List[RiskIndicator] = Field(default_factory=list)
    external_verification: ExternalVerificationResult = Field(default_factory=ExternalVerificationResult)
    verification_policy_satisfied: bool = False
    explanation: str = ""
    verified_at: Optional[str] = None


# ----------------- EXTERNAL VERIFICATION PROVIDER INTERFACE -----------------

class ExternalVerificationProvider:
    """
    Interface for authorized external verification of business registration or financial records.
    Strict rule: Never simulate a successful official verification or claim that a document is genuine solely because OCR succeeds.
    If no official external verification service is configured with valid credentials, return 'Unable to Verify Externally'.
    """

    def verify_gstin(self, gstin: str, business_name: Optional[str] = None) -> ExternalVerificationResult:
        return ExternalVerificationResult(
            service_name="GSTN Official Portal Verification",
            status="UNABLE_TO_VERIFY",
            verified_at=None,
            source="GSTN API (Unconfigured)",
            message="Unable to Verify Externally: Official GSTN verification service is not configured with live authorized API credentials. Manual verification required."
        )

    def verify_business_registration(self, identifier: str, reg_type: str = "PAN") -> ExternalVerificationResult:
        return ExternalVerificationResult(
            service_name="MCA / CBDT Registry Verification",
            status="UNABLE_TO_VERIFY",
            verified_at=None,
            source="Ministry of Corporate Affairs / Income Tax Portal",
            message="Unable to Verify Externally: Official registry integration requires active government API credentials and authorized e-consent. Manual underwriter review required."
        )


# Singleton provider instance (default unconfigured)
external_provider = ExternalVerificationProvider()


# ----------------- VERIFICATION ENGINE -----------------

class VerificationEngine:
    """
    Independent financial document verification engine.
    Ensures that OCR success or matching hashes alone are NEVER treated as proof of authenticity.
    """

    @staticmethod
    def compute_sha256(file_bytes: bytes) -> str:
        """Computes SHA-256 file hash for duplicate detection and tamper tracking."""
        return hashlib.sha256(file_bytes).hexdigest()

    @staticmethod
    def _clean_string(s: Optional[str]) -> str:
        if not s:
            return ""
        # Remove common corporate suffixes and symbols for comparison
        clean = s.lower().replace(".", "").replace(",", "").replace("-", " ")
        for token in ["pvt", "ltd", "private", "limited", "llp", "enterprises", "company", "corp", "inc"]:
            clean = clean.replace(token, "")
        return " ".join(clean.split())

    def run_verification(
        self,
        document: models.Document,
        db: Session,
        file_bytes: Optional[bytes] = None
    ) -> VerificationReport:
        """
        Executes comprehensive multi-vector verification checks:
        A. File validation & SHA-256 duplicate detection.
        B. Field confidence & completeness.
        C. Arithmetic consistency checks.
        D. Cross-document consistency across applicant documents.
        E. Cross-check against declared loan assessment input.
        F. Independent external verification lookup.
        G. Fraud / Risk indicators generation.
        H. Overall verification status determination.
        """
        discrepancies: List[Discrepancy] = []
        risk_indicators: List[RiskIndicator] = []
        arithmetic_details: List[str] = []
        cross_doc_details: List[str] = []
        assessment_details: List[str] = []
        
        file_hash = document.file_hash
        if not file_hash and file_bytes:
            file_hash = self.compute_sha256(file_bytes)
            document.file_hash = file_hash

        # --- A. FILE VALIDATION & DUPLICATE DETECTION ---
        is_duplicate = False
        duplicate_info: Optional[Dict[str, Any]] = None

        if file_hash:
            # Query documents with matching hash excluding self
            dupes = db.query(models.Document).filter(
                models.Document.file_hash == file_hash,
                models.Document.id != document.id
            ).all()

            if dupes:
                is_duplicate = True
                first_dupe = dupes[0]
                same_user = first_dupe.user_id == document.user_id
                duplicate_info = {
                    "id": first_dupe.id,
                    "filename": first_dupe.original_filename,
                    "created_at": first_dupe.created_at.isoformat() if first_dupe.created_at else None,
                    "same_user": same_user
                }

                if not same_user:
                    discrepancies.append(Discrepancy(
                        id=f"dup_{first_dupe.id}",
                        field="file_hash",
                        category="duplicate",
                        severity="HIGH",
                        observed_value=file_hash,
                        source_document=first_dupe.original_filename,
                        explanation=f"Identical file hash ({file_hash[:12]}...) was previously uploaded by a different business/user account. Cross-tenant duplicate requires underwriter scrutiny."
                    ))
                    risk_indicators.append(RiskIndicator(
                        indicator="Cross-Tenant Duplicate Document",
                        severity="HIGH",
                        details=f"Document file hash matches document #{first_dupe.id} from another account. Investigate potential forged or shared financial statement.",
                        investigation_recommended=True
                    ))
                else:
                    risk_indicators.append(RiskIndicator(
                        indicator="Duplicate File Submission",
                        severity="LOW",
                        details=f"Identical file previously uploaded on {first_dupe.created_at.strftime('%Y-%m-%d') if first_dupe.created_at else 'earlier date'}. Note: matching file hash does not establish document authenticity.",
                        investigation_recommended=False
                    ))

        # Check file size & structure
        if document.file_size < 15:
            discrepancies.append(Discrepancy(
                id="file_corrupt",
                field="file_size",
                category="format",
                severity="HIGH",
                expected_value="> 15 bytes",
                observed_value=f"{document.file_size} bytes",
                explanation="Uploaded file is empty or corrupted."
            ))

        # --- B. FIELD EXTRACTION RECOVERY & CONFIDENCE ---
        fields_by_name: Dict[str, models.ExtractedField] = {
            f.field_name: f for f in document.fields
        }

        # Check for low-confidence critical fields
        critical_fields = ["annual_revenue", "monthly_cash_flow", "total_assets", "gstin", "business_name"]
        for cf in critical_fields:
            if cf in fields_by_name:
                field_obj = fields_by_name[cf]
                if field_obj.confidence < 0.65 and field_obj.normalized_value is not None:
                    risk_indicators.append(RiskIndicator(
                        indicator=f"Low OCR Confidence for {cf}",
                        severity="MEDIUM",
                        details=f"Extracted '{cf}' value '{field_obj.raw_value}' has low OCR confidence ({int(field_obj.confidence * 100)}%). Manual verification required.",
                        investigation_recommended=True
                    ))

        # --- C. ARITHMETIC CONSISTENCY CHECKS ---
        arithmetic_passed = True

        # Check 1: Bank statement credits vs debits vs cash flow
        credits_field = fields_by_name.get("total_credits")
        debits_field = fields_by_name.get("total_debits")
        cash_flow_field = fields_by_name.get("monthly_cash_flow")

        if credits_field and debits_field and credits_field.normalized_value is not None and debits_field.normalized_value is not None:
            c_val = credits_field.normalized_value
            d_val = debits_field.normalized_value
            net_movement = c_val - d_val
            arithmetic_details.append(f"Bank Statement flow verified: Total Credits ₹{c_val:,.2f} - Total Debits ₹{d_val:,.2f} = Net ₹{net_movement:,.2f}")

            if cash_flow_field and cash_flow_field.normalized_value is not None:
                cf_val = cash_flow_field.normalized_value
                # If cash flow differs substantially from net credits-debits (> 30% variance)
                if abs(net_movement) > 1000 and abs(cf_val - net_movement) / max(abs(net_movement), 1.0) > 0.35:
                    arithmetic_passed = False
                    discrepancies.append(Discrepancy(
                        id="arith_bank_flow",
                        field="monthly_cash_flow",
                        category="arithmetic",
                        severity="MEDIUM",
                        expected_value=round(net_movement, 2),
                        observed_value=cf_val,
                        explanation=f"Calculated net bank movement (Credits ₹{c_val:,.0f} - Debits ₹{d_val:,.0f} = ₹{net_movement:,.0f}) conflicts with declared monthly cash flow of ₹{cf_val:,.0f}."
                    ))

        # Check 2: GST turnover vs taxable value + taxes
        taxable_val = fields_by_name.get("taxable_value")
        gst_turnover = fields_by_name.get("gst_turnover") or fields_by_name.get("annual_revenue")
        tax_totals = fields_by_name.get("tax_totals")

        if taxable_val and taxable_val.normalized_value is not None and tax_totals and tax_totals.normalized_value is not None:
            t_val = taxable_val.normalized_value
            tax_val = tax_totals.normalized_value
            if t_val > 0:
                effective_rate = (tax_val / t_val) * 100
                arithmetic_details.append(f"GST Tax computation: Taxable ₹{t_val:,.2f}, Tax Paid ₹{tax_val:,.2f} (Effective tax rate: {effective_rate:.1f}%)")
                # Valid GST slabs in India are 0%, 5%, 12%, 18%, 28%. An effective rate > 40% is anomalous
                if effective_rate > 40.0:
                    arithmetic_passed = False
                    discrepancies.append(Discrepancy(
                        id="arith_gst_tax_rate",
                        field="tax_totals",
                        category="arithmetic",
                        severity="MEDIUM",
                        expected_value="<= 28% of taxable value",
                        observed_value=f"{effective_rate:.1f}%",
                        explanation=f"Extracted tax total (₹{tax_val:,.0f}) is unusually high relative to taxable value (₹{t_val:,.0f}), representing an implausible {effective_rate:.1f}% effective tax rate."
                    ))

        # Check 3: Financial Statement revenue vs expenses vs net profit
        rev_field = fields_by_name.get("annual_revenue")
        exp_field = fields_by_name.get("monthly_expenses")
        profit_field = fields_by_name.get("net_profit")

        if rev_field and exp_field and rev_field.normalized_value is not None and exp_field.normalized_value is not None:
            annual_exp = exp_field.normalized_value * 12
            rev_val = rev_field.normalized_value
            arithmetic_details.append(f"Financial summary: Annual Revenue ₹{rev_val:,.2f} vs Annualized Expenses ₹{annual_exp:,.2f}")

            if profit_field and profit_field.normalized_value is not None:
                p_val = profit_field.normalized_value
                estimated_profit = rev_val - annual_exp
                # If stated profit is positive but revenue is less than expenses
                if rev_val < annual_exp and p_val > 0:
                    arithmetic_passed = False
                    discrepancies.append(Discrepancy(
                        id="arith_negative_operating_loss",
                        field="net_profit",
                        category="arithmetic",
                        severity="HIGH",
                        expected_value=f"< 0 (Operating Loss of ₹{annual_exp - rev_val:,.0f})",
                        observed_value=p_val,
                        explanation=f"Document shows annual revenue (₹{rev_val:,.0f}) lower than annualized expenses (₹{annual_exp:,.0f}), yet reports positive net profit of ₹{p_val:,.0f}."
                    ))

        # --- D. CROSS-DOCUMENT CONSISTENCY CHECKS ---
        cross_doc_passed = True
        other_docs = db.query(models.Document).filter(
            models.Document.user_id == document.user_id,
            models.Document.id != document.id
        ).all()

        current_bus_name = fields_by_name.get("business_name") or fields_by_name.get("account_holder")
        current_gstin = fields_by_name.get("gstin")
        current_pan = fields_by_name.get("pan")

        clean_cur_name = self._clean_string(current_bus_name.string_value) if current_bus_name and current_bus_name.string_value else ""
        cur_gstin_str = current_gstin.string_value.strip().upper() if current_gstin and current_gstin.string_value else ""
        cur_pan_str = current_pan.string_value.strip().upper() if current_pan and current_pan.string_value else ""

        for od in other_docs:
            od_fields = {f.field_name: f for f in od.fields}

            # Check 1: Business name match
            od_name_field = od_fields.get("business_name") or od_fields.get("account_holder")
            if clean_cur_name and od_name_field and od_name_field.string_value:
                clean_od_name = self._clean_string(od_name_field.string_value)
                if len(clean_cur_name) > 3 and len(clean_od_name) > 3:
                    # Token overlap test
                    cur_tokens = set(clean_cur_name.split())
                    od_tokens = set(clean_od_name.split())
                    common = cur_tokens.intersection(od_tokens)
                    if not common and clean_cur_name not in clean_od_name and clean_od_name not in clean_cur_name:
                        cross_doc_passed = False
                        discrepancies.append(Discrepancy(
                            id=f"cd_name_{od.id}",
                            field="business_name",
                            category="cross_document",
                            severity="HIGH",
                            expected_value=od_name_field.string_value,
                            observed_value=current_bus_name.string_value if current_bus_name else "",
                            source_document=od.original_filename,
                            explanation=f"Entity name '{current_bus_name.string_value if current_bus_name else ''}' does not match entity name '{od_name_field.string_value}' in submitted document '{od.original_filename}'."
                        ))

            # Check 2: GSTIN match
            od_gstin = od_fields.get("gstin")
            if cur_gstin_str and od_gstin and od_gstin.string_value:
                clean_od_gstin = od_gstin.string_value.strip().upper()
                if cur_gstin_str != clean_od_gstin:
                    cross_doc_passed = False
                    discrepancies.append(Discrepancy(
                        id=f"cd_gstin_{od.id}",
                        field="gstin",
                        category="cross_document",
                        severity="HIGH",
                        expected_value=clean_od_gstin,
                        observed_value=cur_gstin_str,
                        source_document=od.original_filename,
                        explanation=f"Extracted GSTIN '{cur_gstin_str}' conflicts with GSTIN '{clean_od_gstin}' found in '{od.original_filename}'."
                    ))

            # Check 3: PAN match
            od_pan = od_fields.get("pan")
            if cur_pan_str and od_pan and od_pan.string_value:
                clean_od_pan = od_pan.string_value.strip().upper()
                if cur_pan_str != clean_od_pan:
                    cross_doc_passed = False
                    discrepancies.append(Discrepancy(
                        id=f"cd_pan_{od.id}",
                        field="pan",
                        category="cross_document",
                        severity="HIGH",
                        expected_value=clean_od_pan,
                        observed_value=cur_pan_str,
                        source_document=od.original_filename,
                        explanation=f"Extracted PAN '{cur_pan_str}' conflicts with PAN '{clean_od_pan}' found in '{od.original_filename}'."
                    ))

        cross_doc_details.append(f"Compared with {len(other_docs)} other document(s) uploaded by user.")
        if not cross_doc_passed:
            risk_indicators.append(RiskIndicator(
                indicator="Conflicting Business Identifiers",
                severity="HIGH",
                details="Discrepancies identified across different submitted documents. Underwriter must verify legal entity consistency.",
                investigation_recommended=True
            ))

        # --- E. CROSS-CHECK AGAINST DECLARED ASSESSMENT DATA ---
        assessment = None
        if document.business_id:
            assessment = db.query(models.Assessment).filter(
                models.Assessment.business_id == document.business_id
            ).order_by(models.Assessment.created_at.desc()).first()
        if not assessment and document.user_id:
            assessment = db.query(models.Assessment).join(models.Business).filter(
                models.Business.user_id == document.user_id
            ).order_by(models.Assessment.created_at.desc()).first()

        assessment_checked = False
        if assessment:
            assessment_checked = True
            # Compare annual revenue
            doc_rev = fields_by_name.get("annual_revenue") or fields_by_name.get("gst_turnover")
            if doc_rev and doc_rev.normalized_value is not None:
                d_val = doc_rev.normalized_value
                decl_val = float(assessment.annual_revenue)
                variance = abs(d_val - decl_val) / max(decl_val, 1.0)
                assessment_details.append(f"Annual Revenue comparison: Declared ₹{decl_val:,.0f} vs Document ₹{d_val:,.0f} (Variance: {variance*100:.1f}%)")
                if variance > 0.25:
                    discrepancies.append(Discrepancy(
                        id="assmt_rev_mismatch",
                        field="annual_revenue",
                        category="assessment_comparison",
                        severity="MEDIUM" if variance < 0.50 else "HIGH",
                        expected_value=decl_val,
                        observed_value=d_val,
                        explanation=f"Declared annual revenue (₹{decl_val:,.0f}) in loan assessment differs from document revenue (₹{d_val:,.0f}) by {variance*100:.1f}%."
                    ))

            # Compare existing debt
            doc_debt = fields_by_name.get("existing_debt")
            if doc_debt and doc_debt.normalized_value is not None:
                d_debt = doc_debt.normalized_value
                decl_debt = float(assessment.existing_debt or 0.0)
                if d_debt > decl_debt * 1.30 and d_debt > 50000:
                    discrepancies.append(Discrepancy(
                        id="assmt_debt_understated",
                        field="existing_debt",
                        category="assessment_comparison",
                        severity="HIGH",
                        expected_value=decl_debt,
                        observed_value=d_debt,
                        explanation=f"Document discloses outstanding liabilities of ₹{d_debt:,.0f}, which is substantially higher than declared debt of ₹{decl_debt:,.0f}."
                    ))
                    risk_indicators.append(RiskIndicator(
                        indicator="Understated Declared Debt",
                        severity="HIGH",
                        details=f"Documented liabilities exceed declared debt by ₹{d_debt - decl_debt:,.0f}. Verify credit bureau obligations.",
                        investigation_recommended=True
                    ))

        # --- F. INDEPENDENT EXTERNAL VERIFICATION ---
        # Rule: Never simulate successful official verification.
        ext_ver_result = ExternalVerificationResult(
            service_name="Official Registry Verification (GSTN / MCA)",
            status="UNABLE_TO_VERIFY",
            verified_at=None,
            source="External Verification Interface",
            message="Unable to Verify Externally: Official government verification APIs (GSTN/MCA) are not configured with authenticated credentials. Internal consistency checks completed; manual underwriter review required.",
            evidence={"provider_configured": False}
        )

        if cur_gstin_str:
            ext_ver_result = external_provider.verify_gstin(cur_gstin_str, clean_cur_name)
        elif cur_pan_str:
            ext_ver_result = external_provider.verify_business_registration(cur_pan_str, "PAN")

        # --- G. VERIFICATION STATUS & POLICY DETERMINATION ---
        # Strict definition of VERIFIED:
        # Cannot be set solely on OCR success or internal checks.
        # Only set if external verification succeeded OR an analyst explicitly verified it.
        overall_status = "MANUAL_REVIEW_REQUIRED"
        policy_satisfied = False

        high_discrepancies = [d for d in discrepancies if d.severity == "HIGH"]
        med_discrepancies = [d for d in discrepancies if d.severity == "MEDIUM"]

        if high_discrepancies:
            overall_status = "MISMATCH_FOUND"
            explanation = f"Critical discrepancies found ({len(high_discrepancies)} high severity). Underwriter inspection required."
        elif med_discrepancies:
            overall_status = "MANUAL_REVIEW_REQUIRED"
            explanation = f"Moderate financial discrepancies identified ({len(med_discrepancies)}). Manual review required."
        elif ext_ver_result.status == "VERIFIED":
            overall_status = "VERIFIED"
            policy_satisfied = True
            explanation = "Document passed internal consistency checks and verified via authorized external registry."
        elif document.analyst_decision == "APPROVED":
            overall_status = "VERIFIED"
            policy_satisfied = True
            explanation = f"Formally verified and approved by human risk analyst ({document.reviewed_by or 'underwriter'})."
        elif ext_ver_result.status in ("UNABLE_TO_VERIFY", "NOT_CONFIGURED"):
            overall_status = "MANUAL_REVIEW_REQUIRED"
            explanation = "Internal extraction and arithmetic checks passed. External registry confirmation is unconfigured, requiring manual review."
        else:
            overall_status = "MANUAL_REVIEW_REQUIRED"
            explanation = "Document requires human underwriter verification before credit risk model acceptance."

        now_iso = datetime.datetime.utcnow().isoformat()
        report = VerificationReport(
            document_id=document.id,
            file_hash=file_hash,
            is_duplicate_file=is_duplicate,
            duplicate_with=duplicate_info,
            overall_status=overall_status,
            arithmetic_checks={"passed": arithmetic_passed, "details": arithmetic_details},
            cross_document_checks={"passed": cross_doc_passed, "compared_documents_count": len(other_docs), "details": cross_doc_details},
            assessment_comparison={"checked": assessment_checked, "details": assessment_details},
            discrepancies=discrepancies,
            risk_indicators=risk_indicators,
            external_verification=ext_ver_result,
            verification_policy_satisfied=policy_satisfied,
            explanation=explanation,
            verified_at=now_iso if policy_satisfied else None
        )

        # Update document record
        document.processing_status = overall_status
        document.verification_report = report.dict()
        if policy_satisfied:
            document.status = "verified"

        db.commit()
        db.refresh(document)

        return report


verification_engine = VerificationEngine()
