import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..config import settings
from ..schemas.prediction import (
    PredictionRequest,
    PredictionResponse,
    SimulationRequest,
    SimulationResponse,
    PredictionResultOnly,
    PredictionHistoryItem,
    RiskTrendResponse,
    PredictionExplanationResponse
)
from ..services.prediction_service import prediction_service
from ..services.report_service import report_service
from ..services.audit_service import log_audit_event, create_notification_if_alert
from ..services.risk_intelligence_service import risk_intelligence_service
from ..services.model_registry import model_registry_service

router = APIRouter()

def get_authorized_prediction(
    prediction_id: int,
    current_user: models.User,
    db: Session
) -> models.Prediction:
    """Enforces strict multi-tenant ownership and RBAC isolation."""
    prediction = db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction record not found."
        )

    is_owner = prediction.assessment.business.user_id == current_user.uid
    is_analyst_or_admin = getattr(current_user, "role", "user") in ["analyst", "admin"]

    if not is_owner and not is_analyst_or_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this prediction."
        )

    return prediction


# ==============================================================================
# PREDICTION & RISK INTELLIGENCE ENDPOINTS
# ==============================================================================

@router.post("/predict", response_model=PredictionResponse)
@router.post("/predictions/predict", response_model=PredictionResponse)
def predict_risk(
    payload: PredictionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executes AI Risk Intelligence evaluation.
    Computes default probability, normalized risk score (0-100), model confidence,
    data quality audit, 7-dimension categorized factor decomposition, and deterministic underwriting memo.
    """
    try:
        # 1. Save or associate Business Details
        business = db.query(models.Business).filter(
            models.Business.user_id == current_user.uid,
            models.Business.name == payload.name
        ).first()

        if not business:
            business = models.Business(
                user_id=current_user.uid,
                name=payload.name,
                industry=payload.industry,
                age=payload.age,
                employees=payload.employees
            )
            db.add(business)
            db.flush()
        else:
            business.industry = payload.industry
            business.age = payload.age
            business.employees = payload.employees
            db.flush()

        # 2. Save Assessment Details
        assessment = models.Assessment(
            business_id=business.id,
            annual_revenue=payload.annual_revenue,
            monthly_cash_flow=payload.monthly_cash_flow,
            monthly_expenses=payload.monthly_expenses,
            existing_debt=payload.existing_debt,
            digital_transactions=payload.digital_transactions,
            utility_payment_score=payload.utility_payment_score,
            invoice_payment_score=payload.invoice_payment_score,
            previous_defaults=payload.previous_defaults
        )
        db.add(assessment)
        db.flush()

        # 3. Perform ML Risk Intelligence Evaluation
        input_data = payload.model_dump()
        prediction_result = prediction_service.predict_risk(input_data)

        # 4. Save Prediction Result with Risk Intelligence Metadata
        prediction = models.Prediction(
            assessment_id=assessment.id,
            default_probability=prediction_result["default_probability"],
            risk_level=prediction_result["risk_level"],
            risk_score=prediction_result.get("risk_score", prediction_result["default_probability"]),
            confidence=prediction_result["confidence"],
            data_quality_score=prediction_result.get("data_quality_score", 100.0),
            top_factors=prediction_result["top_factors"],
            positive_factors=prediction_result.get("positive_factors", []),
            risk_factors=prediction_result.get("risk_factors", []),
            factor_breakdown=prediction_result.get("factor_breakdown", {}),
            analyst_summary=prediction_result.get("analyst_summary", ""),
            model_version=settings.MODEL_VERSION
        )
        db.add(prediction)
        
        # 5. Save Report data
        report_data = report_service.generate_report_data(
            business_data=input_data,
            assessment_data=input_data,
            prediction_data=prediction_result,
            model_version=settings.MODEL_VERSION
        )
        
        report = models.Report(
            assessment_id=assessment.id,
            report_data=report_data
        )
        db.add(report)
        db.flush()

        # 6. Audit logging
        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="ASSESSMENT_CREATED",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={
                "business_name": business.name,
                "annual_revenue": payload.annual_revenue,
                "existing_debt": payload.existing_debt
            },
            commit=False
        )
        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="CREATE_ASSESSMENT",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={
                "business_name": business.name,
                "risk_level": prediction.risk_level,
                "default_probability": prediction.default_probability
            },
            commit=False
        )
        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="PREDICTION_CREATED",
            resource_type="prediction",
            resource_id=str(prediction.id),
            details={
                "assessment_id": assessment.id,
                "risk_level": prediction.risk_level,
                "default_probability": prediction.default_probability,
                "risk_score": prediction.risk_score,
                "model_version": prediction.model_version
            },
            commit=False
        )
        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="MODEL_VERSION_USED",
            resource_type="model",
            resource_id=prediction.model_version,
            details={
                "prediction_id": prediction.id,
                "model_version": prediction.model_version
            },
            commit=False
        )

        # 7. Check user alert rules
        user_rules = db.query(models.AlertRule).filter(
            models.AlertRule.user_id == current_user.uid,
            models.AlertRule.is_active == True
        ).all()

        for rule in user_rules:
            if rule.rule_type == "high_risk_detected" and prediction.risk_level == "HIGH":
                create_notification_if_alert(
                    db=db,
                    user_id=current_user.uid,
                    title="High Risk Alert Triggered",
                    message=f"Assessment for '{business.name}' flagged HIGH default probability ({prediction.default_probability}%).",
                    notif_type="alert",
                    link=f"/reports?id={assessment.id}",
                    commit=False
                )
            elif rule.rule_type in ("probability_threshold", "score_threshold") and prediction.default_probability >= rule.threshold:
                create_notification_if_alert(
                    db=db,
                    user_id=current_user.uid,
                    title="Risk Threshold Exceeded",
                    message=f"Assessment for '{business.name}' default probability ({prediction.default_probability}%) exceeded threshold of {rule.threshold}%.",
                    notif_type="warning",
                    link=f"/reports?id={assessment.id}",
                    commit=False
                )

        db.commit()

        return PredictionResponse(
            assessment_id=assessment.id,
            default_probability=prediction.default_probability,
            risk_level=prediction.risk_level,
            risk_score=prediction.risk_score if prediction.risk_score is not None else prediction.default_probability,
            confidence=prediction.confidence,
            data_quality_score=prediction.data_quality_score if prediction.data_quality_score is not None else 100.0,
            data_quality_tier=prediction_result.get("data_quality_tier", "High Quality"),
            model_version=prediction.model_version,
            top_factors=prediction.top_factors,
            positive_factors=prediction.positive_factors or [],
            risk_factors=prediction.risk_factors or [],
            factor_breakdown=prediction.factor_breakdown,
            analyst_summary=prediction.analyst_summary
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing credit prediction: {str(e)}"
        )


@router.get("/predictions/history", response_model=List[PredictionHistoryItem])
def get_prediction_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns historical predictions for the authenticated user (or all portfolio assessments for analysts/admins).
    """
    query = db.query(models.Prediction).join(models.Assessment).join(models.Business)

    if getattr(current_user, "role", "user") not in ["analyst", "admin"]:
        query = query.filter(models.Business.user_id == current_user.uid)

    predictions = query.order_by(models.Prediction.created_at.desc()).limit(100).all()

    results = []
    for p in predictions:
        bus = p.assessment.business
        results.append(PredictionHistoryItem(
            prediction_id=p.id,
            assessment_id=p.assessment_id,
            business_name=bus.name,
            industry=bus.industry,
            default_probability=p.default_probability,
            risk_level=p.risk_level,
            risk_score=p.risk_score if p.risk_score is not None else p.default_probability,
            confidence=p.confidence,
            data_quality_score=p.data_quality_score if p.data_quality_score is not None else 95.0,
            model_version=p.model_version,
            created_at=p.created_at
        ))

    return results


@router.get("/predictions/{id}", response_model=PredictionResponse)
def get_prediction_by_id(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves an individual prediction record by ID with ownership enforcement."""
    prediction = get_authorized_prediction(id, current_user, db)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="PREDICTION_VIEWED",
        resource_type="prediction",
        resource_id=str(prediction.id),
        details={"assessment_id": prediction.assessment_id}
    )

    quality_score = prediction.data_quality_score if prediction.data_quality_score is not None else 95.0
    quality_tier = "High Quality" if quality_score >= 85 else ("Medium Quality" if quality_score >= 70 else "Low Quality")

    return PredictionResponse(
        assessment_id=prediction.assessment_id,
        default_probability=prediction.default_probability,
        risk_level=prediction.risk_level,
        risk_score=prediction.risk_score if prediction.risk_score is not None else prediction.default_probability,
        confidence=prediction.confidence,
        data_quality_score=quality_score,
        data_quality_tier=quality_tier,
        model_version=prediction.model_version,
        top_factors=prediction.top_factors,
        positive_factors=prediction.positive_factors or [],
        risk_factors=prediction.risk_factors or [],
        factor_breakdown=prediction.factor_breakdown,
        analyst_summary=prediction.analyst_summary
    )


@router.get("/predictions/{id}/explanation", response_model=PredictionExplanationResponse)
def get_prediction_explanation(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns explainable AI decomposition grouped into 7 categories,
    model confidence indicators, and deterministic analyst memos.
    """
    prediction = get_authorized_prediction(id, current_user, db)
    assessment = prediction.assessment
    bus = assessment.business

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="PREDICTION_EXPLANATION_VIEWED",
        resource_type="prediction",
        resource_id=str(prediction.id),
        details={"assessment_id": prediction.assessment_id}
    )

    # Re-derive factors if not populated in historical record
    factor_breakdown = prediction.factor_breakdown
    if not factor_breakdown:
        data_dict = {
            "name": bus.name,
            "industry": bus.industry,
            "age": bus.age,
            "employees": bus.employees,
            "annual_revenue": assessment.annual_revenue,
            "monthly_cash_flow": assessment.monthly_cash_flow,
            "monthly_expenses": assessment.monthly_expenses,
            "existing_debt": assessment.existing_debt,
            "digital_transactions": assessment.digital_transactions,
            "utility_payment_score": assessment.utility_payment_score,
            "invoice_payment_score": assessment.invoice_payment_score,
            "previous_defaults": assessment.previous_defaults
        }
        factor_breakdown = risk_intelligence_service.categorize_factors(data_dict)

    quality_score = prediction.data_quality_score if prediction.data_quality_score is not None else 92.0
    quality_tier = "High Quality" if quality_score >= 85 else ("Medium Quality" if quality_score >= 70 else "Low Quality")

    analyst_summary = prediction.analyst_summary
    if not analyst_summary:
        analyst_summary = risk_intelligence_service.generate_analyst_summary(
            business_name=bus.name,
            risk_level=prediction.risk_level,
            probability=prediction.default_probability,
            risk_score=prediction.risk_score or prediction.default_probability,
            data_quality_score=quality_score,
            positive_factors=prediction.positive_factors or [],
            risk_factors=prediction.risk_factors or []
        )

    return PredictionExplanationResponse(
        prediction_id=prediction.id,
        assessment_id=prediction.assessment_id,
        business_name=bus.name,
        default_probability=prediction.default_probability,
        risk_level=prediction.risk_level,
        risk_score=prediction.risk_score if prediction.risk_score is not None else prediction.default_probability,
        confidence=prediction.confidence,
        model_confidence_label="Model confidence indicator",
        data_quality_score=quality_score,
        data_quality_tier=quality_tier,
        model_version=prediction.model_version,
        top_factors=prediction.top_factors,
        positive_factors=prediction.positive_factors or [],
        risk_factors=prediction.risk_factors or [],
        factor_breakdown=factor_breakdown,
        analyst_summary=analyst_summary
    )


@router.get("/predictions/{id}/risk-trend", response_model=RiskTrendResponse)
def get_prediction_risk_trend(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Evaluates risk trend comparing current assessment to prior predictions of the same business."""
    prediction = get_authorized_prediction(id, current_user, db)
    assessment = prediction.assessment
    business_id = assessment.business_id

    # Find previous assessment for this enterprise
    prior_assessment = db.query(models.Assessment).filter(
        models.Assessment.business_id == business_id,
        models.Assessment.id < assessment.id
    ).order_by(models.Assessment.id.desc()).first()

    prior_prob = None
    if prior_assessment and prior_assessment.prediction:
        prior_prob = prior_assessment.prediction.default_probability

    trend_data = risk_intelligence_service.calculate_risk_trend(
        current_prob=prediction.default_probability,
        previous_prob=prior_prob
    )

    return RiskTrendResponse(
        assessment_id=assessment.id,
        business_name=assessment.business.name,
        current_probability=prediction.default_probability,
        previous_probability=prior_prob,
        trend=trend_data["trend"],
        trend_label=trend_data["trend_label"],
        delta=trend_data["delta"],
        description=trend_data["description"]
    )


# ==============================================================================
# WHAT-IF RISK SIMULATION
# ==============================================================================

@router.post("/simulate", response_model=SimulationResponse)
@router.post("/predict/simulate", response_model=SimulationResponse)
@router.post("/predictions/simulate", response_model=SimulationResponse)
def simulate_risk(
    payload: SimulationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    What-If Risk Intelligence Simulation endpoint.
    Calculates hypothetical shifts in risk score and factors without overwriting existing assessment records.
    Supports adjusting revenue, expenses, cash flow, debt, loan amount, and alternative indicators.
    """
    baseline_dict = {}

    if payload.assessment_id:
        assessment = db.query(models.Assessment).filter(models.Assessment.id == payload.assessment_id).first()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment ID for simulation baseline not found."
            )
        is_owner = assessment.business.user_id == current_user.uid
        is_staff = getattr(current_user, "role", "user") in ["analyst", "admin"]
        if not is_owner and not is_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access baseline assessment."
            )

        bus = assessment.business
        baseline_dict = {
            "name": bus.name,
            "industry": bus.industry,
            "age": bus.age,
            "employees": bus.employees,
            "annual_revenue": assessment.annual_revenue,
            "monthly_cash_flow": assessment.monthly_cash_flow,
            "monthly_expenses": assessment.monthly_expenses,
            "existing_debt": assessment.existing_debt,
            "digital_transactions": assessment.digital_transactions,
            "utility_payment_score": assessment.utility_payment_score,
            "invoice_payment_score": assessment.invoice_payment_score,
            "previous_defaults": assessment.previous_defaults
        }
    elif payload.baseline_data:
        baseline_dict = payload.baseline_data.model_dump()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either assessment_id or baseline_data must be provided."
        )

    # 1. Run baseline prediction
    baseline_result = prediction_service.predict_risk(baseline_dict)

    # 2. Build simulated dictionary by overriding with hypothetical values
    simulated_dict = dict(baseline_dict)
    summary_of_changes = []

    if payload.simulated_annual_revenue is not None:
        delta = payload.simulated_annual_revenue - baseline_dict["annual_revenue"]
        simulated_dict["annual_revenue"] = payload.simulated_annual_revenue
        summary_of_changes.append(f"Revenue adjusted by ₹{delta:+,.0f} to ₹{payload.simulated_annual_revenue:,.0f}")

    if payload.simulated_monthly_cash_flow is not None:
        delta = payload.simulated_monthly_cash_flow - baseline_dict["monthly_cash_flow"]
        simulated_dict["monthly_cash_flow"] = payload.simulated_monthly_cash_flow
        summary_of_changes.append(f"Monthly cash flow adjusted by ₹{delta:+,.0f} to ₹{payload.simulated_monthly_cash_flow:,.0f}")

    if payload.simulated_monthly_expenses is not None:
        delta = payload.simulated_monthly_expenses - baseline_dict["monthly_expenses"]
        simulated_dict["monthly_expenses"] = payload.simulated_monthly_expenses
        summary_of_changes.append(f"Expenses adjusted by ₹{delta:+,.0f} to ₹{payload.simulated_monthly_expenses:,.0f}")

    if payload.simulated_loan_amount is not None:
        current_debt = simulated_dict.get("existing_debt", 0.0)
        simulated_dict["existing_debt"] = current_debt + payload.simulated_loan_amount
        summary_of_changes.append(f"New loan of ₹{payload.simulated_loan_amount:,.0f} added to debt leverage")
    elif payload.simulated_existing_debt is not None:
        delta = payload.simulated_existing_debt - baseline_dict["existing_debt"]
        simulated_dict["existing_debt"] = payload.simulated_existing_debt
        summary_of_changes.append(f"Existing debt adjusted by ₹{delta:+,.0f} to ₹{payload.simulated_existing_debt:,.0f}")

    if payload.simulated_digital_transactions is not None:
        simulated_dict["digital_transactions"] = payload.simulated_digital_transactions
        summary_of_changes.append(f"Digital transactions adjusted to {payload.simulated_digital_transactions} txns/mo")

    if payload.simulated_utility_score is not None:
        simulated_dict["utility_payment_score"] = payload.simulated_utility_score
        summary_of_changes.append(f"Utility score set to {payload.simulated_utility_score}/100")

    if payload.simulated_invoice_score is not None:
        simulated_dict["invoice_payment_score"] = payload.simulated_invoice_score
        summary_of_changes.append(f"Invoice score set to {payload.simulated_invoice_score}/100")

    if payload.simulated_defaults is not None:
        simulated_dict["previous_defaults"] = payload.simulated_defaults
        summary_of_changes.append(f"Previous defaults count set to {payload.simulated_defaults}")

    if not summary_of_changes:
        summary_of_changes.append("No hypothetical parameters modified.")

    # 3. Run simulated prediction
    simulated_result = prediction_service.predict_risk(simulated_dict)

    prob_delta = round(simulated_result["default_probability"] - baseline_result["default_probability"], 2)
    health_delta = -prob_delta

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="WHAT_IF_SIMULATION_RUN",
        resource_type="simulation",
        details={
            "business": baseline_dict.get("name"),
            "prob_delta": prob_delta,
            "changes_count": len(summary_of_changes)
        }
    )

    return SimulationResponse(
        is_hypothetical=True,
        disclaimer="Scenario results are hypothetical estimates based on modified financial indicators and do not guarantee future outcomes.",
        baseline=PredictionResultOnly(
            default_probability=baseline_result["default_probability"],
            risk_level=baseline_result["risk_level"],
            risk_score=baseline_result.get("risk_score", baseline_result["default_probability"]),
            confidence=baseline_result["confidence"],
            top_factors=baseline_result["top_factors"],
            positive_factors=baseline_result.get("positive_factors", []),
            risk_factors=baseline_result.get("risk_factors", []),
            data_quality_score=baseline_result.get("data_quality_score", 100.0),
            model_version=baseline_result.get("model_version", settings.MODEL_VERSION)
        ),
        simulated=PredictionResultOnly(
            default_probability=simulated_result["default_probability"],
            risk_level=simulated_result["risk_level"],
            risk_score=simulated_result.get("risk_score", simulated_result["default_probability"]),
            confidence=simulated_result["confidence"],
            top_factors=simulated_result["top_factors"],
            positive_factors=simulated_result.get("positive_factors", []),
            risk_factors=simulated_result.get("risk_factors", []),
            data_quality_score=simulated_result.get("data_quality_score", 100.0),
            model_version=simulated_result.get("model_version", settings.MODEL_VERSION)
        ),
        probability_delta=prob_delta,
        health_score_delta=health_delta,
        risk_level_changed=baseline_result["risk_level"] != simulated_result["risk_level"],
        summary_of_changes=summary_of_changes
    )


# ==============================================================================
# ADMIN MODEL MONITORING & MODEL CARD ENDPOINTS
# ==============================================================================

def verify_admin_access(current_user: models.User):
    """Enforces administrator privileges."""
    if getattr(current_user, "role", "user") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Administrator privileges required for model governance."
        )

@router.get("/admin/model-monitoring")
def get_admin_model_monitoring(
    days: Optional[str] = Query(None, description="Time filter: '7', '30', '90', or 'all'"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin-only: Aggregate model monitoring statistics, risk distribution, and averages."""
    verify_admin_access(current_user)

    days_int = None
    if days and days.lower() != "all":
        try:
            days_int = int(days)
        except ValueError:
            pass

    metrics = model_registry_service.get_monitoring_metrics(db=db, days=days_int)
    drift = model_registry_service.get_data_drift_stats(db=db)

    return {
        **metrics,
        "drift_summary": drift
    }


@router.get("/admin/model-card")
def get_admin_model_card(
    current_user: models.User = Depends(get_current_user),
):
    """Admin-only: Returns formal institutional Model Card documentation and Responsible AI disclosures."""
    verify_admin_access(current_user)
    return model_registry_service.get_model_card()


@router.get("/admin/model-performance")
def get_admin_model_performance(
    current_user: models.User = Depends(get_current_user),
):
    """Admin-only: Returns verified evaluation metrics from model_metadata.json."""
    verify_admin_access(current_user)
    return model_registry_service.get_model_info()


@router.get("/admin/model-distribution")
def get_admin_model_distribution(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin-only: Returns portfolio default probability distribution buckets."""
    verify_admin_access(current_user)
    predictions = db.query(models.Prediction).all()

    buckets = {
        "0-10%": 0,
        "10-25%": 0,
        "25-50%": 0,
        "50-75%": 0,
        "75-100%": 0
    }

    for p in predictions:
        prob = p.default_probability
        if prob < 10.0:
            buckets["0-10%"] += 1
        elif prob < 25.0:
            buckets["10-25%"] += 1
        elif prob < 50.0:
            buckets["25-50%"] += 1
        elif prob < 75.0:
            buckets["50-75%"] += 1
        else:
            buckets["75-100%"] += 1

    return {
        "total": len(predictions),
        "distribution_buckets": buckets
    }
