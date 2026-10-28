import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..database import models
from ..schemas.decision_intelligence import (
    UnifiedWorkspaceResponse,
    EvidenceSummaryResponse,
    EvidenceItem,
    ReviewChecklistItem,
    CreditReviewItemResponse,
    DecisionOverrideResponse,
    HumanReviewActionRequest,
    DecisionOverrideRequest,
    PolicyEvaluationResponse
)
from .policy_engine_service import policy_engine_service
from .explainability_service import explainability_service
from .risk_intelligence_service import RiskIntelligenceService

logger = logging.getLogger("decision_workspace_service")


class DecisionWorkspaceService:
    """
    Unified Credit Assessment Workspace Service.
    Consolidates model predictions, SHAP explanations, 7 evidence categories,
    policy rule evaluation, review checklists, and auditable human overrides.
    """

    def get_unified_workspace(
        self,
        assessment_id: int,
        user_uid: str,
        user_role: str,
        db: Session
    ) -> UnifiedWorkspaceResponse:
        """Retrieves or builds the complete unified credit assessment workspace."""
        assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assessment #{assessment_id} not found."
            )

        business = assessment.business
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated business record not found."
            )

        # RBAC and Tenant Isolation check
        if user_role not in ["analyst", "admin"] and business.user_id != user_uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have authorization to view this assessment workspace."
            )

        # 1. Model Prediction & Status
        prediction = assessment.prediction
        model_status = "COMPLETED" if prediction else "PENDING"
        def_prob = round(float(prediction.default_probability), 2) if prediction else 0.0
        risk_lvl = prediction.risk_level if prediction else "UNKNOWN"
        risk_scr = round(float(prediction.risk_score), 1) if (prediction and prediction.risk_score is not None) else def_prob
        model_ver = prediction.model_version if prediction else "1.1.0"
        pred_time = prediction.created_at if prediction else assessment.created_at

        # 2. Document & Verification Status
        docs = db.query(models.Document).filter(models.Document.business_id == business.id).all()
        doc_count = len(docs)
        if doc_count == 0:
            verification_status = "PENDING"
        elif any(d.processing_status == "DISCREPANCY_FLAGGED" or "discrepancy" in str(d.verification_report).lower() for d in docs):
            verification_status = "DISCREPANCY_FLAGGED"
        elif all(d.processing_status in ["VERIFIED", "APPROVED"] for d in docs):
            verification_status = "VERIFIED"
        else:
            verification_status = "PARTIAL"

        # 3. Policy Rule Evaluation
        latest_eval = db.query(models.PolicyEvaluation).filter(
            models.PolicyEvaluation.assessment_id == assessment_id
        ).order_by(models.PolicyEvaluation.evaluated_at.desc()).first()

        if not latest_eval:
            # Automatically run policy evaluation against active policy
            eval_record = policy_engine_service.evaluate_assessment(assessment_id, db)
            policy_eval_resp = policy_engine_service.get_latest_evaluation(assessment_id, db)
            policy_status_val = eval_record["overall_status"]
        else:
            policy_eval_resp = policy_engine_service.get_latest_evaluation(assessment_id, db)
            policy_status_val = latest_eval.overall_status

        # 4. Human Review Status
        raw_review_status = (assessment.review_status or "pending").lower()
        status_map = {
            "pending": "READY_FOR_REVIEW",
            "in_review": "REVIEW_IN_PROGRESS",
            "approved": "REVIEW_COMPLETED",
            "rejected": "REVIEW_COMPLETED",
            "needs_info": "NEEDS_MORE_INFORMATION",
            "escalated": "ESCALATED",
            "submitted": "SUBMITTED"
        }
        human_review_status = status_map.get(raw_review_status, "READY_FOR_REVIEW")

        # 5. TreeSHAP Explanation Integration
        explanation_available = False
        baseline_val = 0.20
        raw_margin_val = 0.0
        top_pos: List[Dict[str, Any]] = []
        top_neg: List[Dict[str, Any]] = []

        try:
            exp_data = explainability_service.get_or_create_explanation(assessment_id, db)
            if exp_data:
                explanation_available = True
                baseline_val = exp_data.get("baseline_probability", 0.20)
                raw_margin_val = exp_data.get("raw_margin", 0.0)
                # Parse top drivers
                all_contr = exp_data.get("feature_contributions", [])
                pos_drivers = [c for c in all_contr if c.get("shap_value", 0.0) > 0]
                neg_drivers = [c for c in all_contr if c.get("shap_value", 0.0) < 0]

                # Sort by absolute SHAP impact
                pos_drivers.sort(key=lambda x: abs(x.get("shap_value", 0.0)), reverse=True)
                neg_drivers.sort(key=lambda x: abs(x.get("shap_value", 0.0)), reverse=True)

                top_pos = pos_drivers[:4]
                top_neg = neg_drivers[:4]
        except Exception as e:
            logger.warning(f"Could not load TreeSHAP explanation for assessment #{assessment_id}: {e}")

        # 6. Evidence Summary (7 Provenance Categories)
        evidence_summary = self._build_evidence_summary(assessment, business, docs, prediction)

        # 7. Configurable Review Checklist
        review_checklist = self._build_review_checklist(
            assessment=assessment,
            business=business,
            docs=docs,
            has_explanation=explanation_available,
            policy_result=policy_status_val
        )

        # 8. Review History & Overrides
        review_records = db.query(models.CreditReviewRecord).filter(
            models.CreditReviewRecord.assessment_id == assessment_id
        ).order_by(models.CreditReviewRecord.created_at.desc()).all()

        review_history_resp = [
            CreditReviewItemResponse(
                id=r.id,
                assessment_id=r.assessment_id,
                analyst_id=r.analyst_id,
                previous_status=r.previous_status,
                new_status=r.new_status,
                action_type=r.action_type,
                recommendation=r.recommendation,
                reason_code=r.reason_code,
                notes=r.notes,
                evidence_references=r.evidence_references or [],
                escalated_to=r.escalated_to,
                created_at=r.created_at
            ) for r in review_records
        ]

        override_records = db.query(models.DecisionOverride).filter(
            models.DecisionOverride.assessment_id == assessment_id
        ).order_by(models.DecisionOverride.created_at.desc()).all()

        overrides_resp = [
            DecisionOverrideResponse(
                id=o.id,
                assessment_id=o.assessment_id,
                actor_id=o.actor_id,
                actor_role=o.actor_role,
                original_model_output=o.original_model_output,
                original_risk_band=o.original_risk_band,
                final_decision=o.final_decision,
                final_risk_band=o.final_risk_band,
                override_type=o.override_type,
                reason_code=o.reason_code,
                rationale=o.rationale,
                evidence_references=o.evidence_references or [],
                policy_version=o.policy_version,
                model_version=o.model_version,
                approval_status=o.approval_status,
                created_at=o.created_at
            ) for o in override_records
        ]

        active_override_resp = overrides_resp[0] if overrides_resp else None

        # Data completeness
        dq_score = prediction.data_quality_score if (prediction and prediction.data_quality_score) else 100.0

        limitations = [
            "SHAP explanations quantify feature attribution in model prediction space; they do NOT prove physical causality.",
            "AI default probability indicates historical pattern alignment and does not constitute statutory loan approval.",
            "Policy engine results evaluate static underwriting guidelines independently from statistical ML outputs.",
            "OCR document extractions represent automated parsing and require human underwriter validation."
        ]

        return UnifiedWorkspaceResponse(
            assessment_id=assessment.id,
            business_id=business.id,
            business_name=business.name,
            industry=business.industry,
            business_age=business.age,
            employees=business.employees,
            created_at=assessment.created_at,
            model_status=model_status,
            verification_status=verification_status,
            policy_status=policy_status_val,
            human_review_status=human_review_status,
            model_version=model_ver,
            default_probability=def_prob,
            risk_level=risk_lvl,
            risk_score=risk_scr,
            data_completeness_pct=dq_score,
            prediction_timestamp=pred_time,
            baseline_value=baseline_val,
            raw_margin=raw_margin_val,
            top_positive_drivers=top_pos,
            top_negative_drivers=top_neg,
            explanation_available=explanation_available,
            evidence_summary=evidence_summary,
            policy_evaluation=policy_eval_resp,
            review_checklist=review_checklist,
            review_history=review_history_resp,
            overrides=overrides_resp,
            active_override=active_override_resp,
            limitations=limitations
        )

    def _build_evidence_summary(
        self,
        assessment: models.Assessment,
        business: models.Business,
        docs: List[models.Document],
        prediction: Optional[models.Prediction]
    ) -> EvidenceSummaryResponse:
        """Builds evidence breakdown across 7 distinct categories with strict provenance."""
        # 1. Declared Information
        applicant_declared = [
            {"field": "Business Name", "value": business.name, "source": "Corporate Registration Application"},
            {"field": "Industry Sector", "value": business.industry, "source": "Self-Declared Form"},
            {"field": "Operating Age", "value": f"{business.age} years", "source": "Self-Declared Form"},
            {"field": "Employees", "value": business.employees, "source": "Self-Declared Form"},
            {"field": "Annual Revenue", "value": f"${assessment.annual_revenue:,.2f}", "source": "Financial Assessment Form"},
            {"field": "Monthly Cash Flow", "value": f"${assessment.monthly_cash_flow:,.2f}", "source": "Financial Assessment Form"},
            {"field": "Monthly Expenses", "value": f"${assessment.monthly_expenses:,.2f}", "source": "Financial Assessment Form"},
            {"field": "Existing Debt", "value": f"${assessment.existing_debt:,.2f}", "source": "Financial Assessment Form"},
            {"field": "Previous Defaults", "value": assessment.previous_defaults, "source": "Self-Declared Credit History"}
        ]

        # 2. Document Extracted
        document_extracted = []
        for d in docs:
            ext = d.extracted_data or {}
            document_extracted.append({
                "document_id": d.id,
                "document_name": d.original_filename,
                "document_type": d.document_type,
                "processing_status": d.processing_status,
                "extracted_fields": ext,
                "source": f"OCR Extraction ({d.original_filename})"
            })

        # 3. Independently Verified
        independently_verified = []
        for d in docs:
            if d.processing_status in ["VERIFIED", "APPROVED"]:
                independently_verified.append({
                    "item": f"Document Verification: {d.original_filename}",
                    "verified_by": d.reviewed_by or "Rule-Engine Validation",
                    "verification_date": d.reviewed_at.isoformat() if d.reviewed_at else None,
                    "status": "VERIFIED"
                })

        # 4. Conflicting or Unverified Information
        conflicts: List[EvidenceItem] = []
        # Check if annual revenue declared differs substantially from any document extraction
        for d in docs:
            ext = d.extracted_data or {}
            doc_rev = ext.get("annual_revenue") or ext.get("total_turnover") or ext.get("gross_receipts")
            if doc_rev is not None:
                try:
                    val = float(doc_rev)
                    diff = abs(val - assessment.annual_revenue)
                    if assessment.annual_revenue > 0 and (diff / assessment.annual_revenue) > 0.20:
                        conflicts.append(EvidenceItem(
                            field_name="annual_revenue",
                            display_name="Annual Revenue Discrepancy",
                            declared_value=f"${assessment.annual_revenue:,.2f}",
                            extracted_ocr_value=f"${val:,.2f}",
                            status="CONFLICTING",
                            source_document=d.original_filename,
                            confidence=0.85,
                            notes=f"Declared revenue differs by {diff/assessment.annual_revenue*100:.1f}% from OCR extraction."
                        ))
                except Exception:
                    pass

        # 5. Derived Financial Metrics
        derived_financial_metrics = []
        if assessment.annual_revenue > 0:
            debt_to_income = round((assessment.existing_debt / assessment.annual_revenue) * 100, 1)
            cf_margin = round((assessment.monthly_cash_flow * 12 / assessment.annual_revenue) * 100, 1)
            exp_ratio = round((assessment.monthly_expenses * 12 / assessment.annual_revenue) * 100, 1)

            derived_financial_metrics = [
                {"metric": "Debt-to-Annual-Revenue Multiple", "value": f"{debt_to_income}%", "assessment": "High" if debt_to_income > 60 else "Acceptable"},
                {"metric": "Annualized Operating Cash Flow Margin", "value": f"{cf_margin}%", "assessment": "Positive" if cf_margin > 10 else "Low/Negative"},
                {"metric": "Operating Expense Ratio", "value": f"{exp_ratio}%", "assessment": "Healthy" if exp_ratio < 80 else "Strained"}
            ]

        # 6. Model Generated Outputs
        model_generated_outputs = {
            "default_probability": round(float(prediction.default_probability), 2) if prediction else None,
            "risk_band": prediction.risk_level if prediction else None,
            "risk_score": prediction.risk_score if prediction else None,
            "data_quality_score": prediction.data_quality_score if prediction else None,
            "model_version": prediction.model_version if prediction else None,
            "confidence_band": "High" if (prediction and prediction.confidence > 0.8) else "Moderate"
        }

        # 7. Human Notes
        human_notes = []
        if assessment.review_notes:
            human_notes.append({
                "author": assessment.reviewed_by or "Credit Analyst",
                "timestamp": assessment.reviewed_at.isoformat() if assessment.reviewed_at else None,
                "notes": assessment.review_notes
            })

        return EvidenceSummaryResponse(
            applicant_declared=applicant_declared,
            document_extracted=document_extracted,
            independently_verified=independently_verified,
            conflicting_unverified=conflicts,
            derived_financial_metrics=derived_financial_metrics,
            model_generated_outputs=model_generated_outputs,
            human_notes=human_notes
        )

    def _build_review_checklist(
        self,
        assessment: models.Assessment,
        business: models.Business,
        docs: List[models.Document],
        has_explanation: bool,
        policy_result: str
    ) -> List[ReviewChecklistItem]:
        """Generates dynamic underwriting verification checklist."""
        has_docs = len(docs) > 0
        financial_complete = assessment.annual_revenue > 0 and assessment.monthly_cash_flow != 0
        has_discrepancy = any("discrepancy" in str(d.verification_report).lower() for d in docs)
        has_analyst_notes = bool(assessment.review_notes and len(assessment.review_notes.strip()) > 5)

        items = [
            ReviewChecklistItem(
                item_id="chk_docs_present",
                label="Required Verification Documents Uploaded",
                category="Documentation",
                is_completed=has_docs,
                status="SATISFIED" if has_docs else "ACTION_REQUIRED",
                details=f"{len(docs)} document(s) uploaded on record." if has_docs else "No supporting verification documents uploaded."
            ),
            ReviewChecklistItem(
                item_id="chk_financial_complete",
                label="Financial Input Completeness & Consistency",
                category="Financial Analysis",
                is_completed=financial_complete,
                status="SATISFIED" if financial_complete else "ACTION_REQUIRED",
                details="Essential cash flow and revenue figures validated." if financial_complete else "Missing critical financial metrics."
            ),
            ReviewChecklistItem(
                item_id="chk_discrepancies",
                label="Document Discrepancy & Conflict Audit",
                category="Verification",
                is_completed=not has_discrepancy,
                status="ACTION_REQUIRED" if has_discrepancy else "SATISFIED",
                details="Potential OCR/Declaration discrepancy detected." if has_discrepancy else "No severe data conflicts flagged."
            ),
            ReviewChecklistItem(
                item_id="chk_xai_reviewed",
                label="TreeSHAP Explainable Risk Factors Reviewed",
                category="Explainability",
                is_completed=has_explanation,
                status="SATISFIED" if has_explanation else "OPTIONAL",
                details="SHAP attributions and top risk drivers available for audit." if has_explanation else "SHAP explanation not generated."
            ),
            ReviewChecklistItem(
                item_id="chk_policy_evaluated",
                label="Statutory & Institutional Policy Rule Compliance",
                category="Governance",
                is_completed=policy_result == "PASS",
                status="SATISFIED" if policy_result == "PASS" else ("ACTION_REQUIRED" if policy_result == "FAIL" else "OPTIONAL"),
                details=f"Policy rules status: {policy_result}"
            ),
            ReviewChecklistItem(
                item_id="chk_analyst_signoff",
                label="Human-in-the-Loop Analyst Review Sign-off",
                category="Underwriter Sign-off",
                is_completed=has_analyst_notes,
                status="SATISFIED" if has_analyst_notes else "ACTION_REQUIRED",
                details="Analyst underwriting notes documented." if has_analyst_notes else "Pending formal underwriter review comments."
            )
        ]
        return items

    def record_human_review(
        self,
        assessment_id: int,
        req: HumanReviewActionRequest,
        analyst_uid: str,
        analyst_role: str,
        db: Session
    ) -> CreditReviewItemResponse:
        """Records an authorized underwriter review decision with rationale."""
        if analyst_role not in ["analyst", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only authorized credit analysts or administrators can record review actions."
            )

        assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assessment #{assessment_id} not found."
            )

        prev_status = assessment.review_status
        new_status = (req.new_status or req.action_type).lower()

        # Update assessment review fields
        assessment.review_status = new_status
        assessment.reviewed_by = analyst_uid
        assessment.reviewed_at = datetime.utcnow()
        if req.notes:
            assessment.review_notes = req.notes

        # Create immutable credit review history record
        review_record = models.CreditReviewRecord(
            assessment_id=assessment_id,
            analyst_id=analyst_uid,
            previous_status=prev_status,
            new_status=new_status,
            action_type=req.action_type,
            recommendation=req.recommendation,
            reason_code=req.reason_code,
            notes=req.notes,
            evidence_references=req.evidence_references,
            escalated_to=req.escalated_to
        )

        try:
            db.add(review_record)
            db.commit()
            db.refresh(review_record)
            logger.info(f"Recorded human review action '{req.action_type}' for assessment #{assessment_id} by {analyst_uid}")
            return CreditReviewItemResponse(
                id=review_record.id,
                assessment_id=review_record.assessment_id,
                analyst_id=review_record.analyst_id,
                previous_status=review_record.previous_status,
                new_status=review_record.new_status,
                action_type=review_record.action_type,
                recommendation=review_record.recommendation,
                reason_code=review_record.reason_code,
                notes=review_record.notes,
                evidence_references=review_record.evidence_references or [],
                escalated_to=review_record.escalated_to,
                created_at=review_record.created_at
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to record review action: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record review action in database."
            )

    def record_decision_override(
        self,
        assessment_id: int,
        req: DecisionOverrideRequest,
        actor_uid: str,
        actor_role: str,
        db: Session
    ) -> DecisionOverrideResponse:
        """
        Records an auditable human override.
        Preserves original model outputs without ever overwriting predictions.
        """
        if actor_role not in ["analyst", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only authorized credit analysts or administrators can execute decision overrides."
            )

        assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assessment #{assessment_id} not found."
            )

        prediction = assessment.prediction
        orig_output = float(prediction.default_probability) if prediction else 0.0
        orig_band = prediction.risk_level if prediction else "UNKNOWN"
        model_ver = prediction.model_version if prediction else "1.1.0"

        # Fetch active policy version
        active_policy = db.query(models.CreditPolicy).filter(models.CreditPolicy.is_active == True).first()
        policy_ver = active_policy.policy_version if active_policy else "default-v1.0"

        override_rec = models.DecisionOverride(
            assessment_id=assessment_id,
            actor_id=actor_uid,
            actor_role=actor_role,
            original_model_output=orig_output,
            original_risk_band=orig_band,
            final_decision=req.final_decision,
            final_risk_band=req.final_risk_band,
            override_type=req.override_type,
            reason_code=req.reason_code,
            rationale=req.rationale,
            evidence_references=req.evidence_references,
            policy_version=policy_ver,
            model_version=model_ver,
            approval_status="APPROVED"
        )

        try:
            db.add(override_rec)
            # Update workflow status to reflect underwriter decision
            assessment.review_status = "approved" if req.final_decision == "APPROVE" else "rejected"
            assessment.reviewed_by = actor_uid
            assessment.reviewed_at = datetime.utcnow()
            assessment.review_notes = f"[OVERRIDE: {req.reason_code}] {req.rationale}"

            db.commit()
            db.refresh(override_rec)
            logger.info(f"Recorded decision override #{override_rec.id} for assessment #{assessment_id} by {actor_uid}")

            return DecisionOverrideResponse(
                id=override_rec.id,
                assessment_id=override_rec.assessment_id,
                actor_id=override_rec.actor_id,
                actor_role=override_rec.actor_role,
                original_model_output=override_rec.original_model_output,
                original_risk_band=override_rec.original_risk_band,
                final_decision=override_rec.final_decision,
                final_risk_band=override_rec.final_risk_band,
                override_type=override_rec.override_type,
                reason_code=override_rec.reason_code,
                rationale=override_rec.rationale,
                evidence_references=override_rec.evidence_references or [],
                policy_version=override_rec.policy_version,
                model_version=override_rec.model_version,
                approval_status=override_rec.approval_status,
                created_at=override_rec.created_at
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to record decision override: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record decision override in database."
            )


decision_workspace_service = DecisionWorkspaceService()
