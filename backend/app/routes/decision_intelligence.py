import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.decision_intelligence import (
    UnifiedWorkspaceResponse,
    HumanReviewActionRequest,
    CreditReviewItemResponse,
    DecisionOverrideRequest,
    DecisionOverrideResponse,
    PolicyEvaluationResponse,
    CreditPolicyResponse,
    CreditPolicyCreateRequest,
    GovernanceSummaryResponse,
    DriftSnapshotResponse,
    GovernanceAlertResponse,
    AlertActionRequest
)
from ..services.decision_workspace_service import decision_workspace_service
from ..services.policy_engine_service import policy_engine_service
from ..services.drift_service import drift_service
from ..services.governance_service import governance_service
from ..services.audit_service import log_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(tags=["decision-intelligence-governance"])


def require_analyst_or_admin(current_user: models.User) -> models.User:
    """Enforces analyst or admin role restriction."""
    role = (getattr(current_user, "role", "user") or "user").lower()
    user_status = (getattr(current_user, "approval_status", "") or "").lower()
    is_admin = role == "admin"
    is_active_analyst = role == "analyst" and user_status in ["approved", "active"]

    if not is_admin and not is_active_analyst:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This operation requires authorized Credit Analyst or Administrator privileges."
        )
    return current_user


def require_admin(current_user: models.User) -> models.User:
    """Enforces administrator role restriction."""
    role = (getattr(current_user, "role", "user") or "user").lower()
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This administrative operation is restricted to verified System Administrators."
        )
    return current_user


# ==============================================================================
# FEATURE A: UNIFIED CREDIT ASSESSMENT WORKSPACE
# ==============================================================================

@router.get(
    "/decision-intelligence/assessments/{assessment_id}",
    response_model=UnifiedWorkspaceResponse,
    summary="Get unified credit assessment workspace"
)
def get_assessment_workspace(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Consolidates model predictions, TreeSHAP explanations, 7 evidence categories,
    policy rule evaluation, verification checklists, and human override records.
    """
    user_role = (getattr(current_user, "role", "user") or "user").lower()
    workspace = decision_workspace_service.get_unified_workspace(
        assessment_id=assessment_id,
        user_uid=current_user.uid,
        user_role=user_role,
        db=db
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="WORKSPACE_ACCESSED",
        resource_type="assessment",
        resource_id=str(assessment_id),
        details={"assessment_id": assessment_id, "user_role": user_role}
    )

    return workspace


# ==============================================================================
# FEATURE C: HUMAN-IN-THE-LOOP REVIEW WORKFLOW
# ==============================================================================

@router.post(
    "/decision-intelligence/assessments/{assessment_id}/reviews",
    response_model=CreditReviewItemResponse,
    summary="Record credit analyst review action"
)
def record_credit_review(
    assessment_id: int,
    req: HumanReviewActionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records an underwriter action (READY_FOR_REVIEW, REVIEW_IN_PROGRESS, NEEDS_MORE_INFORMATION, ESCALATED, REVIEW_COMPLETED)
    with recommendation, reason code, and notes.
    """
    require_analyst_or_admin(current_user)
    user_role = (getattr(current_user, "role", "user") or "user").lower()

    review_item = decision_workspace_service.record_human_review(
        assessment_id=assessment_id,
        req=req,
        analyst_uid=current_user.uid,
        analyst_role=user_role,
        db=db
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="HUMAN_REVIEW_RECORDED",
        resource_type="assessment",
        resource_id=str(assessment_id),
        details={
            "action": req.action_type,
            "new_status": req.new_status,
            "recommendation": req.recommendation,
            "reason_code": req.reason_code
        }
    )

    return review_item


# ==============================================================================
# FEATURE D: AUDITABLE OVERRIDES AND REASONS
# ==============================================================================

@router.post(
    "/decision-intelligence/assessments/{assessment_id}/overrides",
    response_model=DecisionOverrideResponse,
    summary="Record auditable underwriter decision override"
)
def record_decision_override(
    assessment_id: int,
    req: DecisionOverrideRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records an underwriter override of the model output or risk band.
    Never alters the original model prediction records.
    """
    require_analyst_or_admin(current_user)
    user_role = (getattr(current_user, "role", "user") or "user").lower()

    override_item = decision_workspace_service.record_decision_override(
        assessment_id=assessment_id,
        req=req,
        actor_uid=current_user.uid,
        actor_role=user_role,
        db=db
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="DECISION_OVERRIDE_RECORDED",
        resource_type="assessment",
        resource_id=str(assessment_id),
        details={
            "final_decision": req.final_decision,
            "reason_code": req.reason_code,
            "override_type": req.override_type
        }
    )

    return override_item


# ==============================================================================
# FEATURE B: POLICY RULE ENGINE
# ==============================================================================

@router.get(
    "/decision-intelligence/assessments/{assessment_id}/policy-evaluation",
    response_model=PolicyEvaluationResponse,
    summary="Get policy evaluation for an assessment"
)
def get_policy_evaluation(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves the latest policy rule evaluation result for an assessment."""
    user_role = (getattr(current_user, "role", "user") or "user").lower()
    # Trigger workspace check for auth
    decision_workspace_service.get_unified_workspace(
        assessment_id=assessment_id,
        user_uid=current_user.uid,
        user_role=user_role,
        db=db
    )

    evaluation = policy_engine_service.get_latest_evaluation(assessment_id, db)
    if not evaluation:
        # Run on the fly
        policy_engine_service.evaluate_assessment(assessment_id, db)
        evaluation = policy_engine_service.get_latest_evaluation(assessment_id, db)

    return evaluation


@router.post(
    "/decision-intelligence/assessments/{assessment_id}/policy-evaluation",
    response_model=PolicyEvaluationResponse,
    summary="Evaluate or re-evaluate policy rules for an assessment"
)
def evaluate_assessment_policy(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Evaluates the assessment against the currently active underwriting credit policy."""
    require_analyst_or_admin(current_user)
    eval_rec = policy_engine_service.evaluate_assessment(assessment_id, db)
    eval_resp = policy_engine_service.get_latest_evaluation(assessment_id, db)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="POLICY_EVALUATED",
        resource_type="assessment",
        resource_id=str(assessment_id),
        details={"overall_status": eval_rec.get("overall_status"), "policy_version": eval_rec.get("policy_version")}
    )

    return eval_resp


@router.get(
    "/governance/policies",
    response_model=List[CreditPolicyResponse],
    summary="List all configured credit policies"
)
def list_credit_policies(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all configured credit policies and active versions."""
    require_analyst_or_admin(current_user)
    policies = policy_engine_service.list_policies(db)
    return [
        CreditPolicyResponse(
            id=p.id,
            policy_id=p.policy_id,
            version=p.version,
            name=p.name,
            description=p.description,
            rules=p.rules,
            is_active=p.is_active,
            created_by=p.created_by,
            created_at=p.created_at
        ) for p in policies
    ]


@router.post(
    "/governance/policies",
    response_model=CreditPolicyResponse,
    summary="Create or register a new credit policy version"
)
def create_credit_policy(
    req: CreditPolicyCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a new policy version. Strictly restricted to verified Administrators."""
    require_admin(current_user)
    new_policy = policy_engine_service.create_policy(req, current_user.uid, db)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="CREDIT_POLICY_CREATED",
        resource_type="credit_policy",
        resource_id=str(new_policy.id),
        details={"name": new_policy.name, "version": new_policy.version}
    )

    return CreditPolicyResponse(
        id=new_policy.id,
        policy_id=new_policy.policy_id,
        version=new_policy.version,
        name=new_policy.name,
        description=new_policy.description,
        rules=new_policy.rules,
        is_active=new_policy.is_active,
        created_by=new_policy.created_by,
        created_at=new_policy.created_at
    )


# ==============================================================================
# FEATURE E & F & G: MODEL GOVERNANCE, DRIFT & ALERTS
# ==============================================================================

@router.get(
    "/governance/summary",
    response_model=GovernanceSummaryResponse,
    summary="Get unified model governance summary"
)
def get_governance_summary(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns active model registry metadata, drift overview, open alert counts,
    honest performance monitoring status, and statutory fairness disclosures.
    """
    require_analyst_or_admin(current_user)
    return governance_service.get_governance_summary(db)


@router.get(
    "/governance/drift",
    response_model=DriftSnapshotResponse,
    summary="Compute or retrieve latest feature drift snapshot"
)
def get_drift_snapshot(
    window_days: int = Query(default=90, ge=7, le=365),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes genuine Population Stability Index (PSI) against msme_loans_clean.csv.
    Generates persistent alerts if drift exceeds approved thresholds.
    """
    require_analyst_or_admin(current_user)
    return drift_service.compute_drift_snapshot(db, window_days=window_days, save_snapshot=True)


@router.get(
    "/governance/alerts",
    response_model=List[GovernanceAlertResponse],
    summary="Get persistent governance alerts"
)
def get_governance_alerts(
    status: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves persistent governance alerts with filtering."""
    require_analyst_or_admin(current_user)
    return governance_service.get_alerts(db, status=status, severity=severity, limit=limit)


@router.post(
    "/governance/alerts/{alert_id}/action",
    response_model=GovernanceAlertResponse,
    summary="Acknowledge or resolve a governance alert"
)
def update_governance_alert(
    alert_id: int,
    req: AlertActionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Acknowledges or resolves an open alert with reviewer rationale."""
    require_analyst_or_admin(current_user)
    alert = governance_service.update_alert_action(
        db=db,
        alert_id=alert_id,
        action=req.action,
        user_uid=current_user.uid,
        resolution_notes=req.resolution_notes
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action=f"ALERT_{req.action}",
        resource_type="governance_alert",
        resource_id=str(alert_id),
        details={"alert_id": alert_id, "action": req.action, "notes": req.resolution_notes}
    )

    return alert


# ==============================================================================
# FEATURE H: REPORTING AND AUDIT EXPORT
# ==============================================================================

@router.get(
    "/decision-intelligence/assessments/{assessment_id}/report",
    summary="Generate assessment review audit export"
)
def get_assessment_review_report(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generates a complete credit decision intelligence and model governance audit report."""
    user_role = (getattr(current_user, "role", "user") or "user").lower()
    workspace = decision_workspace_service.get_unified_workspace(
        assessment_id=assessment_id,
        user_uid=current_user.uid,
        user_role=user_role,
        db=db
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="DECISION_REPORT_EXPORTED",
        resource_type="assessment",
        resource_id=str(assessment_id),
        details={"assessment_id": assessment_id, "user_role": user_role}
    )

    return {
        "report_title": f"Credit Decision Intelligence & Governance Report — Assessment #{assessment_id}",
        "generated_at": workspace.created_at.isoformat(),
        "workspace_data": workspace.model_dump(),
        "disclaimer": "This report consolidates AI-assisted risk scoring, TreeSHAP explanations, policy engine evaluations, and auditable underwriter decisions. It does not constitute a statutory credit approval guarantee."
    }
