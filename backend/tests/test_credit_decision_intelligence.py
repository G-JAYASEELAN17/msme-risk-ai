import os
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.config import settings
from app.database import models
from app.services.policy_engine_service import policy_engine_service
from app.services.drift_service import DriftService, drift_service
from app.services.governance_service import governance_service
from app.services.decision_workspace_service import decision_workspace_service
from app.schemas.decision_intelligence import (
    ReviewActionRequest,
    DecisionOverrideRequest,
    CreditPolicyCreateRequest,
    AlertActionRequest
)


def create_sample_business_and_assessment(db, uid: str = "user_test_1"):
    """Helper to create an authenticated user, business, assessment, and prediction."""
    # Ensure user exists
    user = db.query(models.User).filter(models.User.uid == uid).first()
    if not user:
        user = models.User(
            uid=uid,
            email=f"{uid}@test.local",
            name=f"Test User {uid}",
            role="user"
        )
        db.add(user)
        db.commit()

    business = models.Business(
        user_id=uid,
        name=f"Apex Logistics {uid}",
        industry="Logistics",
        age=5,
        employees=35,
        location="United States"
    )
    db.add(business)
    db.commit()

    assessment = models.Assessment(
        business_id=business.id,
        annual_revenue=1500000.0,
        monthly_cash_flow=45000.0,
        monthly_expenses=80000.0,
        existing_debt=250000.0,
        digital_transactions=450,
        utility_payment_score=85.0,
        invoice_payment_score=80.0,
        previous_defaults=0,
        review_status="pending"
    )
    db.add(assessment)
    db.commit()

    prediction = models.Prediction(
        assessment_id=assessment.id,
        default_probability=18.5,
        risk_level="LOW",
        risk_score=18.5,
        confidence=0.88,
        data_quality_score=95.0,
        top_factors=["Strong cash flow coverage", "No default history"],
        positive_factors=["Low leverage ratio"],
        risk_factors=[],
        model_version=settings.MODEL_VERSION
    )
    db.add(prediction)
    db.commit()

    return user, business, assessment, prediction


# ==============================================================================
# 1. POLICY ENGINE TESTS
# ==============================================================================

def test_policy_engine_default_evaluation_pass(db_session):
    """Assessments with healthy metrics and required documents pass default underwriting policy."""
    user, business, assessment, _ = create_sample_business_and_assessment(db_session)

    # Attach required PAN and Bank documents
    doc_pan = models.Document(
        user_id=user.uid,
        business_id=business.id,
        filename="pan.pdf",
        original_filename="PAN_Card.pdf",
        file_size=5000,
        mime_type="application/pdf",
        file_path="uploads/pan.pdf",
        document_type="PAN",
        processing_status="VERIFIED"
    )
    doc_bank = models.Document(
        user_id=user.uid,
        business_id=business.id,
        filename="bank.pdf",
        original_filename="Bank_Statement.pdf",
        file_size=5000,
        mime_type="application/pdf",
        file_path="uploads/bank.pdf",
        document_type="BANK_STATEMENT",
        processing_status="VERIFIED"
    )
    db_session.add_all([doc_pan, doc_bank])
    db_session.commit()

    eval_rec = policy_engine_service.evaluate_assessment(assessment.id, db_session)

    assert eval_rec["assessment_id"] == assessment.id
    assert eval_rec["policy_version"] == "1.0.0"
    assert eval_rec["overall_status"] in ["PASS", "REVIEW_REQUIRED"]
    assert eval_rec["passed_count"] >= 5
    assert len(eval_rec["rule_results"]) == 8


def test_policy_engine_fails_on_zero_revenue_and_defaults(db_session):
    """Assessments with zero revenue or high default counts fail policy rules."""
    user, business, _, _ = create_sample_business_and_assessment(db_session, uid="user_distressed")
    bad_assessment = models.Assessment(
        business_id=business.id,
        annual_revenue=0.0,  # Zero revenue violates mandatory rule
        monthly_cash_flow=-20000.0,
        monthly_expenses=30000.0,
        existing_debt=800000.0,
        digital_transactions=0,
        utility_payment_score=10.0,
        invoice_payment_score=10.0,
        previous_defaults=3,  # Severe default history
        review_status="pending"
    )
    db_session.add(bad_assessment)
    db_session.commit()

    eval_rec = policy_engine_service.evaluate_assessment(bad_assessment.id, db_session)
    assert eval_rec["overall_status"] in ["FAIL", "REVIEW_REQUIRED"]
    assert eval_rec["failed_count"] >= 1

    # Check specific rule outcomes
    rule_map = {r["rule_id"]: r["status"] for r in eval_rec["rule_results"]}
    assert rule_map.get("RULE_REV_MIN") == "FAIL"
    assert rule_map.get("RULE_DEFAULT_HISTORY") == "FAIL"


def test_custom_policy_creation_and_evaluation(db_session):
    """Administrators can register new policy versions and evaluate against them."""
    _, _, assessment, _ = create_sample_business_and_assessment(db_session)

    custom_rules = [
        {
            "rule_id": "CUSTOM_MIN_AGE",
            "name": "Minimum 3 Years Operating Age",
            "description": "Requires business operating age to be at least 3 years.",
            "category": "ELIGIBILITY",
            "condition": "business.age >= 3",
            "severity": "CRITICAL",
            "enabled": True
        }
    ]

    req = CreditPolicyCreateRequest(
        policy_id="enterprise-policy",
        version="enterprise-v2.0",
        name="Strict Enterprise Policy",
        description="Enterprise credit risk policy requiring mature tenure.",
        rules=custom_rules,
        is_active=True
    )

    new_policy = policy_engine_service.create_policy(req, "admin_uid", db_session)
    assert new_policy.version == "enterprise-v2.0"
    assert new_policy.is_active is True

    # Re-evaluate assessment against active policy
    eval_rec = policy_engine_service.evaluate_assessment(assessment.id, db_session)
    assert eval_rec["policy_version"] == "enterprise-v2.0"
    assert eval_rec["overall_status"] == "PASS"


# ==============================================================================
# 2. WORKSPACE AND STATUS SEPARATION TESTS
# ==============================================================================

def test_unified_workspace_assembly_and_provenance(db_session):
    """Unified workspace aggregates 7 evidence categories, TreeSHAP, and checklists."""
    user, business, assessment, _ = create_sample_business_and_assessment(db_session)

    # Attach sample document
    doc = models.Document(
        user_id=user.uid,
        business_id=business.id,
        filename="bank_stmt.pdf",
        original_filename="Q4_Bank_Statement.pdf",
        file_size=10240,
        mime_type="application/pdf",
        file_path="uploads/bank_stmt.pdf",
        processing_status="VERIFIED",
        extracted_data={"annual_revenue": 1450000.0}
    )
    db_session.add(doc)
    db_session.commit()

    workspace = decision_workspace_service.get_unified_workspace(
        assessment_id=assessment.id,
        user_uid=user.uid,
        user_role="user",
        db=db_session
    )

    assert workspace.assessment_id == assessment.id
    assert workspace.business_name == business.name
    # Status separation verification
    assert workspace.model_status in ["COMPLETED", "PENDING"]
    assert workspace.verification_status in ["VERIFIED", "PARTIAL", "PENDING"]
    assert workspace.policy_status in ["PASS", "FAIL", "REVIEW_REQUIRED"]
    assert workspace.human_review_status in ["READY_FOR_REVIEW", "REVIEW_IN_PROGRESS", "REVIEW_COMPLETED"]

    # 7 evidence categories
    ev = workspace.evidence_summary
    assert len(ev.applicant_declared) >= 8
    assert len(ev.document_extracted) >= 1
    assert len(ev.independently_verified) >= 1
    assert len(ev.derived_financial_metrics) >= 1
    assert ev.model_generated_outputs["default_probability"] == 18.5

    # Checklist
    assert len(workspace.review_checklist) == 6
    doc_chk = next(c for c in workspace.review_checklist if c.item_id == "chk_docs_present")
    assert doc_chk.is_completed is True


def test_status_separation_integrity(db_session):
    """Model status, verification status, policy status, and review status are completely separated."""
    user, business, assessment, _ = create_sample_business_and_assessment(db_session)

    workspace = decision_workspace_service.get_unified_workspace(
        assessment_id=assessment.id,
        user_uid=user.uid,
        user_role="user",
        db=db_session
    )

    # Change review status on assessment
    assessment.review_status = "needs_info"
    db_session.commit()

    updated = decision_workspace_service.get_unified_workspace(
        assessment_id=assessment.id,
        user_uid=user.uid,
        user_role="user",
        db=db_session
    )

    # Human review status updated to NEEDS_MORE_INFORMATION
    assert updated.human_review_status == "NEEDS_MORE_INFORMATION"
    # Model status remains COMPLETED
    assert updated.model_status == "COMPLETED"
    # Default probability remains unchanged
    assert updated.default_probability == 18.5


# ==============================================================================
# 3. HUMAN REVIEW & DECISION OVERRIDES TESTS
# ==============================================================================

def test_analyst_review_workflow_and_rationale(db_session):
    """Authorized analysts can record review actions, reason codes, and notes."""
    _, _, assessment, _ = create_sample_business_and_assessment(db_session)

    req = ReviewActionRequest(
        action_type="RECOMMENDATION_RECORDED",
        new_status="REVIEW_IN_PROGRESS",
        recommendation="REFER_TO_SENIOR",
        reason_code="HIGH_LEVERAGE_MANUAL_AUDIT",
        notes="Borrower has elevated debt obligations requiring senior underwriter concurrence.",
        evidence_references=["Q4_Bank_Statement.pdf"]
    )

    review_item = decision_workspace_service.record_human_review(
        assessment_id=assessment.id,
        req=req,
        analyst_uid="analyst_99",
        analyst_role="analyst",
        db=db_session
    )

    assert review_item.assessment_id == assessment.id
    assert review_item.analyst_id == "analyst_99"
    assert review_item.recommendation == "REFER_TO_SENIOR"
    assert review_item.reason_code == "HIGH_LEVERAGE_MANUAL_AUDIT"
    assert assessment.review_status == "review_in_progress"


def test_decision_override_preserves_model_predictions(db_session):
    """Overrides record human business outcome without altering original model prediction."""
    _, _, assessment, prediction = create_sample_business_and_assessment(db_session)
    original_prob = prediction.default_probability
    original_band = prediction.risk_level

    req = DecisionOverrideRequest(
        final_decision="APPROVE",
        final_risk_band="LOW",
        override_type="DECISION_OVERRIDE",
        reason_code="SUBSTANTIAL_UNENCUMBERED_COLLATERAL",
        rationale="Borrower pledged audited real-estate collateral fully mitigating cash-flow volatility.",
        evidence_references=["Collateral_Appraisal_2026.pdf"]
    )

    override_resp = decision_workspace_service.record_decision_override(
        assessment_id=assessment.id,
        req=req,
        actor_uid="senior_analyst_1",
        actor_role="analyst",
        db=db_session
    )

    assert override_resp.assessment_id == assessment.id
    assert override_resp.original_model_output == original_prob
    assert override_resp.original_risk_band == original_band
    assert override_resp.final_decision == "APPROVE"
    assert override_resp.reason_code == "SUBSTANTIAL_UNENCUMBERED_COLLATERAL"

    # CRITICAL INVARIANT: Original prediction record MUST NOT be overwritten
    db_session.refresh(prediction)
    assert prediction.default_probability == original_prob
    assert prediction.risk_level == original_band

    # Assessment review status updated to reflect human approval
    assert assessment.review_status == "approved"


# ==============================================================================
# 4. DRIFT & GOVERNANCE TESTS
# ==============================================================================

def test_drift_service_psi_calculation(db_session):
    """Computes genuine Population Stability Index (PSI) against msme_loans_clean.csv."""
    # Seed 10 assessments
    for i in range(10):
        create_sample_business_and_assessment(db_session, uid=f"user_psi_{i}")

    snap = drift_service.compute_drift_snapshot(db_session, window_days=90, save_snapshot=True)

    assert snap.observation_count >= 10
    assert "annual_revenue" in snap.feature_drift_metrics
    assert "industry" in snap.feature_drift_metrics
    assert snap.overall_drift_status in ["STABLE", "MODERATE_DRIFT", "SIGNIFICANT_DRIFT"]

    rev_metric = snap.feature_drift_metrics["annual_revenue"]
    assert rev_metric.feature_type == "numerical"
    assert rev_metric.baseline_mean is not None


def test_drift_service_baseline_unavailable_handling(db_session):
    """When baseline reference dataset is missing, gracefully returns BASELINE_UNAVAILABLE."""
    non_existent_service = DriftService(reference_path="data/processed/non_existent.csv")
    snap = non_existent_service.compute_drift_snapshot(db_session, window_days=90, save_snapshot=False)

    assert snap.overall_drift_status == "BASELINE_UNAVAILABLE"
    assert snap.feature_drift_metrics["annual_revenue"].status == "BASELINE_UNAVAILABLE"


def test_governance_alerts_lifecycle(db_session):
    """Verifies governance alert creation, deduplication, acknowledgement, and resolution."""
    # Create manual alert
    alert = models.GovernanceAlert(
        alert_type="FEATURE_DRIFT",
        severity="CRITICAL",
        title="Severe Drift in Annual Revenue",
        description="PSI exceeded 0.250 on annual revenue.",
        metric_name="annual_revenue",
        observed_value=0.312,
        threshold_value=0.250,
        model_version=settings.MODEL_VERSION,
        status="OPEN"
    )
    db_session.add(alert)
    db_session.commit()

    # Acknowledge
    ack = governance_service.update_alert_action(
        db=db_session,
        alert_id=alert.id,
        action="ACKNOWLEDGE",
        user_uid="analyst_1"
    )
    assert ack.status == "ACKNOWLEDGED"
    assert ack.acknowledged_by == "analyst_1"

    # Resolve
    res = governance_service.update_alert_action(
        db=db_session,
        alert_id=alert.id,
        action="RESOLVE",
        user_uid="analyst_1",
        resolution_notes="Portfolio seasonal uptick verified."
    )
    assert res.status == "RESOLVED"
    assert res.resolved_by == "analyst_1"
    assert "seasonal uptick" in res.resolution_notes


def test_performance_monitoring_truthful_unavailability():
    """Performance monitoring truthfully reports unlinked ground truth rather than fabricating metrics."""
    perf_status = governance_service.get_performance_monitoring_status()
    assert perf_status["status"] == "PERFORMANCE_MONITORING_UNAVAILABLE"
    assert "12-to-24 month" in perf_status["reason"]
    assert perf_status["training_validation_reference"]["verified_roc_auc"] == 0.9647


def test_fairness_governance_statutory_disclosure():
    """Fairness governance reports NOT_EVALUATED with RBI non-discrimination justification."""
    fairness = governance_service.get_fairness_governance_disclosure()
    assert fairness["fairness_status"] == "NOT_EVALUATED"
    assert "Reserve Bank of India" in fairness["regulatory_framework"]
    assert "intentionally excluded" in fairness["disclosure"]


# ==============================================================================
# 5. API INTEGRATION & RBAC TESTS
# ==============================================================================

def test_api_workspace_access_authorized_and_idor_rejected(client, db_session):
    """User can access own assessment workspace; other users are rejected with 403."""
    user_alpha, _, assessment, _ = create_sample_business_and_assessment(db_session, uid="alpha_owner")

    # 1. Owner can access
    headers_alpha = {"Authorization": f"Bearer test_token:{user_alpha.uid}:{user_alpha.email}:Alpha Owner"}
    resp_alpha = client.get(f"/api/decision-intelligence/assessments/{assessment.id}", headers=headers_alpha)
    assert resp_alpha.status_code == 200
    assert resp_alpha.json()["assessment_id"] == assessment.id

    # 2. Another normal user is rejected with 403 Forbidden
    headers_beta = {"Authorization": "Bearer test_token:beta_stranger:beta@test.local:Beta Stranger"}
    resp_beta = client.get(f"/api/decision-intelligence/assessments/{assessment.id}", headers=headers_beta)
    assert resp_beta.status_code == 403
    assert "not have authorization" in resp_beta.json()["detail"].lower()


def test_api_analyst_can_review_and_normal_user_forbidden(client, db_session):
    """Only analysts/admins can submit review actions and decision overrides."""
    _, _, assessment, _ = create_sample_business_and_assessment(db_session, uid="user_target")

    # Analyst user
    analyst = models.User(
        uid="analyst_hero",
        email="analyst_hero@test.local",
        name="Analyst Hero",
        role="analyst",
        approval_status="approved"
    )
    db_session.add(analyst)
    db_session.commit()

    headers_analyst = {"Authorization": f"Bearer test_token:{analyst.uid}:{analyst.email}:Analyst Hero"}
    headers_user = {"Authorization": "Bearer test_token:user_target:user_target@test.local:Normal User"}

    review_payload = {
        "action_type": "STATUS_CHANGE",
        "new_status": "REVIEW_IN_PROGRESS",
        "recommendation": "APPROVE",
        "reason_code": "VERIFIED_CASH_FLOW",
        "notes": "Verified audited statements",
        "evidence_references": []
    }

    # 1. Normal user tries to record review -> 403 Forbidden
    resp_user = client.post(
        f"/api/decision-intelligence/assessments/{assessment.id}/reviews",
        headers=headers_user,
        json=review_payload
    )
    assert resp_user.status_code == 403

    # 2. Analyst records review -> 200 OK
    resp_analyst = client.post(
        f"/api/decision-intelligence/assessments/{assessment.id}/reviews",
        headers=headers_analyst,
        json=review_payload
    )
    assert resp_analyst.status_code == 200
    assert resp_analyst.json()["action_type"] == "STATUS_CHANGE"


def test_api_governance_summary_and_alerts(client, db_session):
    """Analysts can view governance summary and manage alert lifecycle via API."""
    analyst = models.User(
        uid="analyst_gov",
        email="analyst_gov@test.local",
        name="Governance Analyst",
        role="analyst",
        approval_status="approved"
    )
    db_session.add(analyst)
    db_session.commit()

    headers = {"Authorization": f"Bearer test_token:{analyst.uid}:{analyst.email}:Governance Analyst"}

    # 1. Governance Summary
    resp_gov = client.get("/api/governance/summary", headers=headers)
    assert resp_gov.status_code == 200
    data = resp_gov.json()
    assert "active_model" in data
    assert data["performance_monitoring_status"] == "PERFORMANCE_MONITORING_UNAVAILABLE"
    assert data["fairness_status"] == "NOT_EVALUATED"

    # 2. Create alert in DB and acknowledge via API
    alert = models.GovernanceAlert(
        alert_type="SCHEMA_MISMATCH",
        severity="WARNING",
        title="Unrecognized column in batch inference",
        description="Optional telemetry field present.",
        model_version=settings.MODEL_VERSION,
        status="OPEN"
    )
    db_session.add(alert)
    db_session.commit()

    action_payload = {"action": "ACKNOWLEDGE", "resolution_notes": None}
    resp_ack = client.post(f"/api/governance/alerts/{alert.id}/action", headers=headers, json=action_payload)
    assert resp_ack.status_code == 200
    assert resp_ack.json()["status"] == "ACKNOWLEDGED"
