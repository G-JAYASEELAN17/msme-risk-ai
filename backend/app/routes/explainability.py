import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..config import settings
from ..services.explainability_service import explainability_service
from ..services.audit_service import log_audit_event
from ..schemas.explainability import (
    LocalExplanationResponse,
    GlobalExplanationResponse,
    CounterfactualRequest,
    CounterfactualResponse,
    WhatIfExplanationRequest,
    WhatIfExplanationResponse,
    StabilityEvaluationResponse,
    ModelMetadataResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explainability", tags=["explainability"])


def get_authorized_assessment(
    assessment_id: int,
    current_user: models.User,
    db: Session
) -> models.Assessment:
    """Enforces multi-tenant ownership and RBAC isolation for assessment explainability."""
    assessment = db.query(models.Assessment).options(
        joinedload(models.Assessment.business),
        joinedload(models.Assessment.prediction)
    ).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment #{assessment_id} not found."
        )

    is_owner = assessment.business is not None and assessment.business.user_id == current_user.uid
    user_role = (getattr(current_user, "role", "user") or "user").lower()
    user_status = (getattr(current_user, "approval_status", "") or "").lower()

    is_admin = user_role == "admin"
    is_active_analyst = user_role == "analyst" and user_status in ["approved", "active"]

    if not is_owner and not is_admin and not is_active_analyst:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access explanations for this assessment."
        )

    return assessment


# ==============================================================================
# INDIVIDUAL ASSESSMENT EXPLAINABILITY
# ==============================================================================

@router.get("/assessments/{assessment_id}", response_model=LocalExplanationResponse)
def get_assessment_explanation(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves full explainable AI decomposition for a credit risk assessment.
    Returns TreeSHAP waterfall values, baseline expected value, signed contributions,
    and plain-language underwriting explanations.
    """
    assessment = get_authorized_assessment(assessment_id, current_user, db)

    try:
        explanation = explainability_service.get_or_create_local_explanation(
            assessment_id=assessment.id,
            db=db
        )

        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="EXPLANATION_VIEWED",
            resource_type="assessment_explanation",
            resource_id=str(assessment.id),
            details={
                "assessment_id": assessment.id,
                "model_version": explanation.get("model_version"),
                "risk_level": explanation.get("risk_level")
            }
        )

        return LocalExplanationResponse(**explanation)
    except Exception as e:
        logger.error(f"Error generating explanation for assessment #{assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating model explanation: {str(e)}"
        )


@router.get("/assessments/{assessment_id}/shap", response_model=LocalExplanationResponse)
def get_assessment_shap_breakdown(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias for retrieving TreeSHAP waterfall attributions for an assessment."""
    return get_assessment_explanation(assessment_id=assessment_id, current_user=current_user, db=db)


@router.post("/assessments/{assessment_id}/refresh", response_model=LocalExplanationResponse)
def refresh_assessment_explanation(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Forces genuine recalculation of TreeSHAP attribution and refreshes persisted database record.
    """
    assessment = get_authorized_assessment(assessment_id, current_user, db)

    try:
        explanation = explainability_service.get_or_create_local_explanation(
            assessment_id=assessment.id,
            db=db,
            force_refresh=True
        )

        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="EXPLANATION_REFRESHED",
            resource_type="assessment_explanation",
            resource_id=str(assessment.id),
            details={
                "assessment_id": assessment.id,
                "model_version": explanation.get("model_version"),
                "risk_level": explanation.get("risk_level")
            }
        )

        return LocalExplanationResponse(**explanation)
    except Exception as e:
        logger.error(f"Error refreshing explanation for assessment #{assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing model explanation: {str(e)}"
        )


@router.get("/assessments/{assessment_id}/export")
def export_assessment_explanation(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Produces a comprehensive Explainable AI audit report payload for export/download.
    """
    assessment = get_authorized_assessment(assessment_id, current_user, db)

    try:
        explanation = explainability_service.get_or_create_local_explanation(
            assessment_id=assessment.id,
            db=db
        )

        # Retrieve any stored counterfactual simulations
        cf_sims = db.query(models.CounterfactualSimulation).filter(
            models.CounterfactualSimulation.assessment_id == assessment.id
        ).order_by(models.CounterfactualSimulation.created_at.desc()).limit(5).all()

        scenarios = []
        for s in cf_sims:
            scenarios.append({
                "target_risk_level": s.target_risk_level,
                "status": s.status,
                "proposed_changes": s.proposed_changes,
                "counterfactual_probability": s.counterfactual_probability,
                "counterfactual_risk_level": s.counterfactual_risk_level,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })

        bus = assessment.business
        business_info = {
            "name": bus.name if bus else "Unknown Business",
            "industry": bus.industry if bus else "General",
            "created_at": assessment.created_at.isoformat() if assessment.created_at else None
        }

        export_data = {
            "report_title": "MSME Credit Risk TreeSHAP Explainability Audit Report",
            "generated_at": datetime.utcnow().isoformat(),
            "exported_by": current_user.email,
            "assessment_id": assessment.id,
            "business": business_info,
            "explanation": explanation,
            "counterfactual_scenarios": scenarios,
            "regulatory_disclaimer": (
                "This report provides algorithmic explainability decompositions via exact TreeSHAP. "
                "Feature attributions quantify model output margin shifts relative to the ensemble prior expectation "
                "and do not constitute proof of real-world causality or a guarantee of loan approval."
            )
        }

        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="EXPLANATION_EXPORTED",
            resource_type="assessment_explanation_report",
            resource_id=str(assessment.id),
            details={"assessment_id": assessment.id}
        )

        return export_data
    except Exception as e:
        logger.error(f"Error exporting explanation for assessment #{assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting explanation report: {str(e)}"
        )


# ==============================================================================
# GLOBAL MODEL EXPLAINABILITY
# ==============================================================================

@router.get("/global", response_model=GlobalExplanationResponse)
def get_global_model_explanation(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes global feature importance via mean absolute SHAP values across evaluation data,
    contrasted with XGBoost built-in Gain and Weight metrics.
    """
    user_role = (getattr(current_user, "role", "user") or "user").lower()
    user_status = (getattr(current_user, "approval_status", "") or "").lower()
    if user_role == "analyst" and user_status not in ["approved", "active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Analyst account is awaiting administrator approval or inactive."
        )

    try:
        global_res = explainability_service.get_global_importance(db=db)

        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="GLOBAL_EXPLANATION_VIEWED",
            resource_type="model_global_explanation",
            resource_id=settings.MODEL_VERSION,
            details={"model_version": settings.MODEL_VERSION}
        )

        return GlobalExplanationResponse(**global_res)
    except Exception as e:
        logger.error(f"Error calculating global explainability: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating global model explainability: {str(e)}"
        )


# ==============================================================================
# CONSTRAINED COUNTERFACTUAL ANALYSIS
# ==============================================================================

@router.post("/assessments/{assessment_id}/counterfactuals", response_model=CounterfactualResponse)
def generate_assessment_counterfactuals(
    assessment_id: int,
    payload: Optional[CounterfactualRequest] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates realistic, actionable counterfactual scenarios showing what changes
    in debt, cash flow, and payment scores could alter the predicted risk band.
    """
    assessment = get_authorized_assessment(assessment_id, current_user, db)

    try:
        target_risk = payload.target_risk_level if payload else None
        cf_res = explainability_service.generate_counterfactuals(
            assessment_id=assessment.id,
            target_risk_level=target_risk,
            user_id=current_user.uid,
            db=db
        )

        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="COUNTERFACTUAL_SIMULATED",
            resource_type="counterfactual_simulation",
            resource_id=str(assessment.id),
            details={
                "assessment_id": assessment.id,
                "target_risk_level": target_risk,
                "status": cf_res.get("status")
            }
        )

        return CounterfactualResponse(**cf_res)
    except Exception as e:
        logger.error(f"Error generating counterfactuals for #{assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating counterfactual analysis: {str(e)}"
        )


# ==============================================================================
# WHAT-IF SCENARIO RE-EXPLANATION
# ==============================================================================

@router.post("/assessments/{assessment_id}/what-if", response_model=WhatIfExplanationResponse)
def simulate_assessment_what_if(
    assessment_id: int,
    payload: WhatIfExplanationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Recalculates genuine model prediction and fresh TreeSHAP values for modified
    hypothetical inputs without altering the original assessment record.
    """
    assessment = get_authorized_assessment(assessment_id, current_user, db)

    try:
        whatif_res = explainability_service.simulate_what_if(
            assessment_id=assessment.id,
            hypothetical_inputs=payload.hypothetical_inputs,
            db=db
        )

        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="WHAT_IF_SIMULATED",
            resource_type="what_if_simulation",
            resource_id=str(assessment.id),
            details={
                "assessment_id": assessment.id,
                "changed_count": len(whatif_res.get("changed_features", []))
            }
        )

        return WhatIfExplanationResponse(**whatif_res)
    except Exception as e:
        logger.error(f"Error simulating what-if for #{assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error evaluating what-if scenario: {str(e)}"
        )


# ==============================================================================
# EXPLANATION STABILITY & ROBUSTNESS
# ==============================================================================

@router.post("/assessments/{assessment_id}/stability", response_model=StabilityEvaluationResponse)
def evaluate_assessment_stability(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Evaluates prediction and explanation robustness against small perturbations (±5% to ±8%)
    across continuous input features.
    """
    assessment = get_authorized_assessment(assessment_id, current_user, db)

    try:
        stab_res = explainability_service.evaluate_stability(
            assessment_id=assessment.id,
            db=db
        )

        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="STABILITY_EVALUATED",
            resource_type="stability_evaluation",
            resource_id=str(assessment.id),
            details={
                "assessment_id": assessment.id,
                "stability_rating": stab_res.get("stability_rating")
            }
        )

        return StabilityEvaluationResponse(**stab_res)
    except Exception as e:
        logger.error(f"Error evaluating stability for #{assessment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating explanation stability: {str(e)}"
        )


# ==============================================================================
# MODEL METADATA & EVALUATION PROVENANCE
# ==============================================================================

@router.get("/models/{model_version}/metadata", response_model=ModelMetadataResponse)
def get_model_version_metadata(
    model_version: str,
    current_user: models.User = Depends(get_current_user)
):
    """Retrieves verified model metadata and evaluation metrics for a specific model version."""
    user_role = (getattr(current_user, "role", "user") or "user").lower()
    user_status = (getattr(current_user, "approval_status", "") or "").lower()
    if user_role == "analyst" and user_status not in ["approved", "active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Analyst account is awaiting administrator approval or inactive."
        )

    if model_version != settings.MODEL_VERSION and model_version != "latest":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version '{model_version}' not registered in active runtime."
        )

    try:
        meta = explainability_service.get_model_metadata()
        return ModelMetadataResponse(**meta)
    except Exception as e:
        logger.error(f"Error loading model metadata: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving model metadata: {str(e)}"
        )
