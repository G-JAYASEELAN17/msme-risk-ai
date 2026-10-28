import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..database import models

logger = logging.getLogger("policy_engine")

DEFAULT_POLICY_ID = "CP-MSME-STANDARD-V1"
DEFAULT_POLICY_VERSION = "1.0.0"

DEFAULT_POLICY_RULES = [
    {
        "rule_id": "RULE_DOC_PAN",
        "name": "Mandatory Tax Identity Verification",
        "description": "Applicant or corporate PAN card must be present and verified via official registry.",
        "category": "VERIFICATION",
        "severity": "CRITICAL",
        "threshold_value": "VERIFIED",
        "enabled": True
    },
    {
        "rule_id": "RULE_DOC_BANK",
        "name": "Operational Bank Statements Requirement",
        "description": "At least 6 months of active commercial bank statements must be uploaded.",
        "category": "DOCUMENTATION",
        "severity": "CRITICAL",
        "threshold_value": "PRESENT",
        "enabled": True
    },
    {
        "rule_id": "RULE_REV_MIN",
        "name": "Commercial Scale Minimum Revenue",
        "description": "Annual operating revenue must meet or exceed ₹5,00,000 for commercial underwriting.",
        "category": "FINANCIAL_COMPLETENESS",
        "severity": "WARNING",
        "threshold_value": 500000.0,
        "enabled": True
    },
    {
        "rule_id": "RULE_LEVERAGE_MAX",
        "name": "Maximum Debt-to-Revenue Multiple",
        "description": "Total debt obligations must not exceed 4.0x annual operating revenue.",
        "category": "UNDERWRITING_THRESHOLDS",
        "severity": "CRITICAL",
        "threshold_value": 4.0,
        "enabled": True
    },
    {
        "rule_id": "RULE_CASH_FLOW_BUFFER",
        "name": "Operating Cash Flow Expenditure Buffer",
        "description": "Monthly operating cash flow must be positive and cover at least 15% of monthly expenditures.",
        "category": "UNDERWRITING_THRESHOLDS",
        "severity": "WARNING",
        "threshold_value": 0.15,
        "enabled": True
    },
    {
        "rule_id": "RULE_NO_UNRESOLVED_CRITICAL_DISCREPANCY",
        "name": "Zero Unresolved Critical Discrepancies",
        "description": "No open high or critical severity discrepancies between declared revenue and bank statements.",
        "category": "DATA_INTEGRITY",
        "severity": "CRITICAL",
        "threshold_value": 0,
        "enabled": True
    },
    {
        "rule_id": "RULE_DEFAULT_HISTORY",
        "name": "Prior Credit Default Limit",
        "description": "Applicant must not have more than 1 historical contractual default or charge-off event.",
        "category": "UNDERWRITING_THRESHOLDS",
        "severity": "CRITICAL",
        "threshold_value": 1,
        "enabled": True
    },
    {
        "rule_id": "RULE_HIGH_RISK_MANUAL_REVIEW",
        "name": "High Risk Model Escalation Trigger",
        "description": "Predictions with default probability >= 55.0% mandate senior underwriting escalation.",
        "category": "UNDERWRITING_THRESHOLDS",
        "severity": "WARNING",
        "threshold_value": 55.0,
        "enabled": True
    }
]


class PolicyEngineService:
    """
    Configurable, auditable policy rule engine operating independently of the XGBoost model.
    Evaluates institutional underwriting policies, records outcomes, and tracks version history.
    """

    def get_or_create_default_policy(self, db: Session) -> models.CreditPolicy:
        """Retrieves or provisions the default active credit underwriting policy."""
        policy = db.query(models.CreditPolicy).filter(
            models.CreditPolicy.policy_id == DEFAULT_POLICY_ID,
            models.CreditPolicy.is_active == True
        ).first()

        if not policy:
            policy = models.CreditPolicy(
                policy_id=DEFAULT_POLICY_ID,
                version=DEFAULT_POLICY_VERSION,
                name="MSME Standard Commercial Credit Underwriting Policy",
                description="Institutional risk governance standards covering identity, leverage, cash flow buffer, and discrepancies.",
                rules=DEFAULT_POLICY_RULES,
                is_active=True,
                created_by="system_policy_engine"
            )
            db.add(policy)
            db.commit()
            db.refresh(policy)

        return policy

    def list_policies(self, db: Session) -> List[models.CreditPolicy]:
        """Lists all registered credit policy versions."""
        self.get_or_create_default_policy(db)
        return db.query(models.CreditPolicy).order_by(models.CreditPolicy.created_at.desc()).all()

    def create_policy(
        self,
        req,
        creator_uid: str,
        db: Session
    ) -> models.CreditPolicy:
        """Creates and optionally activates a new credit policy version."""
        if getattr(req, "is_active", False):
            db.query(models.CreditPolicy).update({"is_active": False})
            db.commit()

        rules_list = [r.model_dump() if hasattr(r, "model_dump") else r for r in req.rules]
        new_policy = models.CreditPolicy(
            policy_id=req.policy_id,
            version=req.version,
            name=req.name,
            description=req.description,
            rules=rules_list,
            is_active=req.is_active,
            created_by=creator_uid
        )
        db.add(new_policy)
        db.commit()
        db.refresh(new_policy)
        return new_policy

    def evaluate_assessment(
        self,
        assessment_id: int,
        db: Session,
        policy_id: Optional[str] = None,
        evaluated_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates an assessment against the active credit policy rules.
        Saves and returns the PolicyEvaluation outcome.
        """
        assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
        if not assessment:
            raise ValueError(f"Assessment #{assessment_id} not found.")

        # Determine policy
        if policy_id:
            policy = db.query(models.CreditPolicy).filter(
                models.CreditPolicy.policy_id == policy_id
            ).first()
            if not policy:
                policy = self.get_or_create_default_policy(db)
        else:
            policy = db.query(models.CreditPolicy).filter(
                models.CreditPolicy.is_active == True
            ).order_by(models.CreditPolicy.created_at.desc()).first()
            if not policy:
                policy = self.get_or_create_default_policy(db)

        rules = policy.rules or DEFAULT_POLICY_RULES

        # Gather evidence items
        bus = assessment.business
        pred = assessment.prediction
        rev = float(assessment.annual_revenue or 0.0)
        debt = float(assessment.existing_debt or 0.0)
        cf = float(assessment.monthly_cash_flow or 0.0)
        exp = float(assessment.monthly_expenses or 1.0)
        defaults = int(assessment.previous_defaults or 0)
        prob = float(pred.default_probability if pred else 0.0)

        # Supporting documents
        docs = db.query(models.Document).filter(
            models.Document.business_id == bus.id
        ).all()
        doc_types = [d.document_type.upper() for d in docs if d.document_type]

        # Identity verification
        identity = db.query(models.IdentityVerification).filter(
            models.IdentityVerification.business_id == bus.id,
            models.IdentityVerification.id_type == "PAN"
        ).first()
        pan_verified = identity is not None and identity.verification_status == "VERIFIED"

        # Discrepancies
        discrepancies = db.query(models.FinancialDiscrepancy).filter(
            models.FinancialDiscrepancy.business_id == bus.id,
            models.FinancialDiscrepancy.verification_status.in_(["OPEN", "INVESTIGATING"])
        ).all()
        critical_discrepancies = [d for d in discrepancies if d.severity in ["HIGH", "CRITICAL"]]

        rule_results = []
        passed_count = 0
        failed_count = 0
        review_required_count = 0

        for r in rules:
            r_id = r.get("rule_id")
            name = r.get("name", r_id)
            cat = r.get("category", "UNDERWRITING_THRESHOLDS")
            sev = r.get("severity", "WARNING")
            thresh = r.get("threshold_value")
            
            # Rule 1: PAN Document & Identity
            if r_id == "RULE_DOC_PAN":
                has_pan_doc = any("PAN" in t for t in doc_types)
                if pan_verified:
                    status = "PASS"
                    rat = "PAN identity independently verified against statutory registry."
                    obs = "VERIFIED"
                elif has_pan_doc:
                    status = "REVIEW_REQUIRED"
                    rat = "PAN document uploaded but automated external verification pending."
                    obs = "UPLOADED_PENDING_VERIFICATION"
                else:
                    status = "FAIL"
                    rat = "Mandatory PAN card document missing from application records."
                    obs = "MISSING"
                refs = ["documents.PAN_CARD", "identity_verifications.PAN"]

            # Rule 2: Bank Statement Document
            elif r_id == "RULE_DOC_BANK":
                has_bank = any("BANK" in t for t in doc_types)
                if has_bank:
                    status = "PASS"
                    rat = f"Operational bank statement documents uploaded ({len([d for d in docs if 'BANK' in (d.document_type or '').upper()])} files)."
                    obs = "PRESENT"
                else:
                    status = "FAIL"
                    rat = "Operational 6-month bank statement records missing."
                    obs = "MISSING"
                refs = ["documents.BANK_STATEMENT"]

            # Rule 3: Minimum Annual Revenue
            elif r_id == "RULE_REV_MIN":
                min_rev = float(thresh or 500000.0)
                obs = rev
                if rev >= min_rev:
                    status = "PASS"
                    rat = f"Annual turnover ₹{rev:,.0f} meets standard commercial threshold (₹{min_rev:,.0f})."
                elif rev > 0:
                    status = "REVIEW_REQUIRED"
                    rat = f"Turnover ₹{rev:,.0f} is below standard commercial baseline (₹{min_rev:,.0f}); underwriter review needed."
                else:
                    status = "FAIL"
                    rat = "Annual operating revenue reported as zero or missing."
                refs = [f"assessments.annual_revenue: {rev}"]

            # Rule 4: Debt-to-Revenue Leverage
            elif r_id == "RULE_LEVERAGE_MAX":
                max_dtr = float(thresh or 4.0)
                dtr = round(debt / max(rev, 1.0), 2)
                obs = dtr
                if rev <= 0:
                    status = "UNABLE_TO_EVALUATE"
                    rat = "Cannot compute leverage ratio due to zero declared revenue."
                elif dtr <= max_dtr:
                    status = "PASS"
                    rat = f"Debt-to-revenue ratio {dtr}x is within policy limit ({max_dtr}x)."
                else:
                    status = "FAIL"
                    rat = f"Debt-to-revenue ratio {dtr}x exceeds maximum allowable leverage ({max_dtr}x)."
                refs = [f"assessments.existing_debt: {debt}", f"assessments.annual_revenue: {rev}"]

            # Rule 5: Cash Flow Buffer Ratio
            elif r_id == "RULE_CASH_FLOW_BUFFER":
                min_buf = float(thresh or 0.15)
                cf_ratio = round(cf / max(exp, 1.0), 3)
                obs = cf_ratio
                if cf <= 0:
                    status = "FAIL"
                    rat = f"Negative monthly cash flow (₹{cf:,.0f}) impairs debt servicing."
                elif cf_ratio >= min_buf:
                    status = "PASS"
                    rat = f"Monthly cash flow covers {cf_ratio*100:.1f}% of expenditures, meeting minimum buffer ({min_buf*100:.0f}%)."
                else:
                    status = "REVIEW_REQUIRED"
                    rat = f"Cash flow buffer ({cf_ratio*100:.1f}%) is tight relative to expenditures; underwriter review required."
                refs = [f"assessments.monthly_cash_flow: {cf}", f"assessments.monthly_expenses: {exp}"]

            # Rule 6: Critical Discrepancies
            elif r_id == "RULE_NO_UNRESOLVED_CRITICAL_DISCREPANCY":
                obs = len(critical_discrepancies)
                if len(critical_discrepancies) == 0:
                    status = "PASS"
                    rat = "Zero unresolved high/critical discrepancies detected across applicant and bank records."
                else:
                    status = "REVIEW_REQUIRED"
                    rat = f"{len(critical_discrepancies)} open critical financial discrepancy flagged between bank statement and declared figures."
                refs = [f"financial_discrepancies count: {len(critical_discrepancies)}"]

            # Rule 7: Historical Defaults
            elif r_id == "RULE_DEFAULT_HISTORY":
                max_def = int(thresh or 1)
                obs = defaults
                if defaults == 0:
                    status = "PASS"
                    rat = "Clean credit track record with zero prior default events."
                elif defaults <= max_def:
                    status = "REVIEW_REQUIRED"
                    rat = f"Applicant has {defaults} historical default event; policy requires mitigation review."
                else:
                    status = "FAIL"
                    rat = f"Applicant has {defaults} default events, exceeding policy limit of {max_def}."
                refs = [f"assessments.previous_defaults: {defaults}"]

            # Rule 8: High Risk Escalation
            elif r_id == "RULE_HIGH_RISK_MANUAL_REVIEW":
                max_prob = float(thresh or 55.0)
                obs = prob
                if prob < max_prob:
                    status = "PASS"
                    rat = f"Model predicted default probability ({prob:.1f}%) is below escalation threshold ({max_prob:.0f}%)."
                else:
                    status = "REVIEW_REQUIRED"
                    rat = f"Elevated default probability ({prob:.1f}%) triggers mandatory senior underwriter escalation."
                refs = [f"predictions.default_probability: {prob}%"]

            else:
                status = "NOT_APPLICABLE"
                rat = "Generic policy rule definition."
                obs = None
                refs = []

            if status == "PASS":
                passed_count += 1
            elif status == "FAIL":
                failed_count += 1
            elif status == "REVIEW_REQUIRED":
                review_required_count += 1

            rule_results.append({
                "rule_id": r_id,
                "name": name,
                "category": cat,
                "severity": sev,
                "status": status,
                "observed_value": obs,
                "threshold_value": thresh,
                "rationale": rat,
                "evidence_references": refs
            })

        # Overall policy outcome determination
        has_critical_failure = any(r["status"] == "FAIL" and r["severity"] == "CRITICAL" for r in rule_results)
        has_failure = any(r["status"] == "FAIL" for r in rule_results)
        has_review = any(r["status"] == "REVIEW_REQUIRED" for r in rule_results)

        if has_critical_failure:
            overall_status = "FAIL"
        elif has_failure or has_review:
            overall_status = "REVIEW_REQUIRED"
        else:
            overall_status = "PASS"

        # Persist PolicyEvaluation
        eval_record = models.PolicyEvaluation(
            assessment_id=assessment.id,
            policy_id=policy.policy_id,
            policy_version=policy.version,
            overall_status=overall_status,
            passed_count=passed_count,
            failed_count=failed_count,
            review_required_count=review_required_count,
            rule_results=rule_results,
            evaluated_by=evaluated_by or "system",
            evaluated_at=datetime.utcnow()
        )
        db.add(eval_record)
        db.commit()
        db.refresh(eval_record)

        return {
            "id": eval_record.id,
            "assessment_id": eval_record.assessment_id,
            "policy_id": eval_record.policy_id,
            "policy_version": eval_record.policy_version,
            "overall_status": eval_record.overall_status,
            "passed_count": eval_record.passed_count,
            "failed_count": eval_record.failed_count,
            "review_required_count": eval_record.review_required_count,
            "rule_results": eval_record.rule_results,
            "evaluated_by": eval_record.evaluated_by,
            "evaluated_at": eval_record.evaluated_at
        }

    def get_latest_evaluation(self, assessment_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Retrieves the latest policy evaluation for an assessment."""
        record = db.query(models.PolicyEvaluation).filter(
            models.PolicyEvaluation.assessment_id == assessment_id
        ).order_by(models.PolicyEvaluation.evaluated_at.desc()).first()

        if not record:
            return None

        return {
            "id": record.id,
            "assessment_id": record.assessment_id,
            "policy_id": record.policy_id,
            "policy_version": record.policy_version,
            "overall_status": record.overall_status,
            "passed_count": record.passed_count,
            "failed_count": record.failed_count,
            "review_required_count": record.review_required_count,
            "rule_results": record.rule_results,
            "evaluated_by": record.evaluated_by,
            "evaluated_at": record.evaluated_at
        }


policy_engine_service = PolicyEngineService()
