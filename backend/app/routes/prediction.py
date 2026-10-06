from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..config import settings
from ..schemas.prediction import (
    PredictionRequest,
    PredictionResponse,
    SimulationRequest,
    SimulationResponse,
    PredictionResultOnly
)
from ..services.prediction_service import prediction_service
from ..services.report_service import report_service
from ..services.audit_service import log_audit_event, create_notification_if_alert

router = APIRouter()

@router.post("/predict", response_model=PredictionResponse)
def predict_risk(
    payload: PredictionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # 1. Save or associate Business Details tied directly to authenticated user UID
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
            # Update business specs if needed
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

        # 3. Perform ML Prediction
        input_data = payload.model_dump()
        prediction_result = prediction_service.predict_risk(input_data)

        # 4. Save Prediction Result
        prediction = models.Prediction(
            assessment_id=assessment.id,
            default_probability=prediction_result["default_probability"],
            risk_level=prediction_result["risk_level"],
            confidence=prediction_result["confidence"],
            top_factors=prediction_result["top_factors"],
            positive_factors=prediction_result.get("positive_factors", []),
            risk_factors=prediction_result.get("risk_factors", []),
            model_version=settings.MODEL_VERSION
        )
        db.add(prediction)
        
        # 5. Create and Save Report data
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
        db.add(prediction)
        db.add(report)
        db.flush()

        # 6. Audit logging (batched without individual commits)
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
            action="PREDICTION_GENERATED",
            resource_type="prediction",
            resource_id=str(prediction.id),
            details={
                "assessment_id": assessment.id,
                "risk_level": prediction.risk_level,
                "default_probability": prediction.default_probability,
                "confidence": prediction.confidence
            },
            commit=False
        )
        log_audit_event(
            db=db,
            user_id=current_user.uid,
            action="REPORT_GENERATED",
            resource_type="report",
            resource_id=str(report.id),
            details={
                "assessment_id": assessment.id,
                "business_name": business.name
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
                    message=f"Assessment for '{business.name}' default probability ({prediction.default_probability}%) exceeded your alert rule threshold of {rule.threshold}%.",
                    notif_type="warning",
                    link=f"/reports?id={assessment.id}",
                    commit=False
                )

        db.commit()

        # Return the prediction result structure
        return PredictionResponse(
            assessment_id=assessment.id,
            default_probability=prediction_result["default_probability"],
            risk_level=prediction_result["risk_level"],
            confidence=prediction_result["confidence"],
            top_factors=prediction_result["top_factors"],
            positive_factors=prediction_result.get("positive_factors", []),
            risk_factors=prediction_result.get("risk_factors", [])
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing credit prediction: {str(e)}"
        )

@router.post("/simulate", response_model=SimulationResponse)
@router.post("/predict/simulate", response_model=SimulationResponse)
def simulate_risk(
    payload: SimulationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    What-If Risk Simulation endpoint.
    Calculates hypothetical shifts in risk score and factors without overwriting existing assessment records.
    """
    baseline_dict = {}

    if payload.assessment_id:
        assessment = db.query(models.Assessment).filter(models.Assessment.id == payload.assessment_id).first()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment ID for simulation baseline not found."
            )
        if assessment.business.user_id != current_user.uid:
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
        summary_of_changes.append(f"Revenue adjusted by ${delta:+,.0f} to ${payload.simulated_annual_revenue:,.0f}")

    if payload.simulated_monthly_cash_flow is not None:
        delta = payload.simulated_monthly_cash_flow - baseline_dict["monthly_cash_flow"]
        simulated_dict["monthly_cash_flow"] = payload.simulated_monthly_cash_flow
        summary_of_changes.append(f"Monthly cash flow adjusted by ${delta:+,.0f} to ${payload.simulated_monthly_cash_flow:,.0f}")

    if payload.simulated_monthly_expenses is not None:
        delta = payload.simulated_monthly_expenses - baseline_dict["monthly_expenses"]
        simulated_dict["monthly_expenses"] = payload.simulated_monthly_expenses
        summary_of_changes.append(f"Expenses adjusted by ${delta:+,.0f} to ${payload.simulated_monthly_expenses:,.0f}")

    if payload.simulated_existing_debt is not None:
        delta = payload.simulated_existing_debt - baseline_dict["existing_debt"]
        simulated_dict["existing_debt"] = payload.simulated_existing_debt
        summary_of_changes.append(f"Existing debt adjusted by ${delta:+,.0f} to ${payload.simulated_existing_debt:,.0f}")

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
        action="SIMULATE_RISK",
        resource_type="simulation",
        details={
            "business": baseline_dict.get("name"),
            "prob_delta": prob_delta,
            "changes_count": len(summary_of_changes)
        }
    )

    return SimulationResponse(
        is_hypothetical=True,
        disclaimer="Simulated results are hypothetical estimates based on modified financial indicators and do not overwrite or replace official assessment records.",
        baseline=PredictionResultOnly(
            default_probability=baseline_result["default_probability"],
            risk_level=baseline_result["risk_level"],
            confidence=baseline_result["confidence"],
            top_factors=baseline_result["top_factors"],
            positive_factors=baseline_result.get("positive_factors", []),
            risk_factors=baseline_result.get("risk_factors", [])
        ),
        simulated=PredictionResultOnly(
            default_probability=simulated_result["default_probability"],
            risk_level=simulated_result["risk_level"],
            confidence=simulated_result["confidence"],
            top_factors=simulated_result["top_factors"],
            positive_factors=simulated_result.get("positive_factors", []),
            risk_factors=simulated_result.get("risk_factors", [])
        ),
        probability_delta=prob_delta,
        health_score_delta=health_delta,
        risk_level_changed=baseline_result["risk_level"] != simulated_result["risk_level"],
        summary_of_changes=summary_of_changes
    )
