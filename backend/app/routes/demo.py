import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..services.prediction_service import prediction_service
from ..config import settings

logger = logging.getLogger("demo_api")
router = APIRouter()

DEMO_SAMPLE_DATA = {
    "name": "Sri Lakshmi Engineering Works",
    "industry": "Manufacturing",
    "age": 6,
    "employees": 28,
    "annual_revenue": 2400000.0,
    "monthly_cash_flow": 150000.0,
    "monthly_expenses": 90000.0,
    "existing_debt": 210000.0,
    "digital_transactions": 380,
    "utility_payment_score": 88.0,
    "invoice_payment_score": 85.0,
    "previous_defaults": 0,
    "loan_amount": 150000.0,
    "loan_tenure": 24
}

class DemoAssessmentRequest(BaseModel):
    name: str = Field("Sri Lakshmi Engineering Works", description="Demo enterprise name")
    industry: str = Field("Manufacturing", description="Industry classification")
    age: int = Field(6, ge=0, description="Business age in years")
    employees: int = Field(28, ge=1, description="Number of full-time employees")
    annual_revenue: float = Field(2400000.0, ge=0, description="Annual turnover in USD")
    monthly_cash_flow: float = Field(150000.0, description="Net monthly cash flow")
    monthly_expenses: float = Field(90000.0, ge=0, description="Monthly operating expenditure")
    existing_debt: float = Field(210000.0, ge=0, description="Total active liabilities")
    digital_transactions: int = Field(380, ge=0, description="Digital payments per month")
    utility_payment_score: float = Field(88.0, ge=0, le=100, description="Utility payment punctuality index")
    invoice_payment_score: float = Field(85.0, ge=0, le=100, description="Invoice fulfillment punctuality index")
    previous_defaults: int = Field(0, ge=0, description="Historical credit defaults count")
    loan_amount: Optional[float] = Field(150000.0, ge=0, description="Requested facility amount")
    loan_tenure: Optional[int] = Field(24, ge=0, description="Facility tenure in months")

class DemoSimulationRequest(BaseModel):
    baseline_data: DemoAssessmentRequest
    simulated_annual_revenue: Optional[float] = None
    simulated_monthly_cash_flow: Optional[float] = None
    simulated_monthly_expenses: Optional[float] = None
    simulated_existing_debt: Optional[float] = None
    simulated_loan_amount: Optional[float] = None
    simulated_loan_tenure: Optional[int] = None

@router.get("/sample", summary="Get synthetic demo MSME data")
def get_demo_sample():
    """
    Returns synthetic demonstration enterprise profile for Sri Lakshmi Engineering Works.
    Contains no real borrower records; strictly synthetic telemetry.
    """
    return {
        "is_demo": True,
        "label": "Demo Data",
        "notice": "Synthetic demonstration dataset. Does not represent actual customer or financial institution records.",
        "sample": DEMO_SAMPLE_DATA
    }

@router.post("/assess", summary="Run safe unauthenticated AI risk assessment on demo data")
def assess_demo_risk(payload: DemoAssessmentRequest):
    """
    Executes live XGBoost v1.1.0 risk inference and SHAP explainability on demo data.
    Strictly isolated: does not persist database records or expose customer information.
    """
    try:
        data_dict = payload.model_dump()
        result = prediction_service.predict_risk(data_dict)
        return {
            "is_demo": True,
            "demo_label": "Demo Data — Synthetic Evaluation",
            "demo_disclaimer": "Scenario assessment executed using active XGBoost v1.1.0 model on synthetic demonstration data. No database entries or loan commitments created.",
            "risk_tier": result.get("risk_level"),
            "confidence_score": result.get("confidence"),
            "explanation": {
                "positive_factors": result.get("positive_factors", []),
                "negative_factors": result.get("risk_factors", [])
            },
            **result
        }
    except Exception as e:
        logger.error(f"Demo assessment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Demo evaluation engine encountered an error. Please try again."
        )

@router.post("/simulate", summary="Run counterfactual What-If scenario simulation on demo data")
def simulate_demo_scenario(payload: DemoSimulationRequest):
    """
    Computes What-If counterfactual adjustments for the demo enterprise.
    """
    try:
        baseline_dict = payload.baseline_data.model_dump()
        baseline_result = prediction_service.predict_risk(baseline_dict)

        simulated_dict = dict(baseline_dict)
        changes = []

        if payload.simulated_annual_revenue is not None and payload.simulated_annual_revenue != baseline_dict.get("annual_revenue"):
            diff = payload.simulated_annual_revenue - baseline_dict.get("annual_revenue", 0)
            changes.append(f"Annual Revenue shifted by ${diff:+,.0f}")
            simulated_dict["annual_revenue"] = payload.simulated_annual_revenue

        if payload.simulated_monthly_cash_flow is not None and payload.simulated_monthly_cash_flow != baseline_dict.get("monthly_cash_flow"):
            diff = payload.simulated_monthly_cash_flow - baseline_dict.get("monthly_cash_flow", 0)
            changes.append(f"Monthly Cash Flow shifted by ${diff:+,.0f}")
            simulated_dict["monthly_cash_flow"] = payload.simulated_monthly_cash_flow

        if payload.simulated_existing_debt is not None and payload.simulated_existing_debt != baseline_dict.get("existing_debt"):
            diff = payload.simulated_existing_debt - baseline_dict.get("existing_debt", 0)
            changes.append(f"Existing Debt shifted by ${diff:+,.0f}")
            simulated_dict["existing_debt"] = payload.simulated_existing_debt

        if payload.simulated_monthly_expenses is not None and payload.simulated_monthly_expenses != baseline_dict.get("monthly_expenses"):
            diff = payload.simulated_monthly_expenses - baseline_dict.get("monthly_expenses", 0)
            changes.append(f"Monthly Expenses shifted by ${diff:+,.0f}")
            simulated_dict["monthly_expenses"] = payload.simulated_monthly_expenses

        simulated_result = prediction_service.predict_risk(simulated_dict)
        prob_delta = round(simulated_result["default_probability"] - baseline_result["default_probability"], 3)
        risk_score_delta = simulated_result["risk_score"] - baseline_result["risk_score"]

        return {
            "is_demo": True,
            "is_hypothetical": True,
            "disclaimer": "Scenario results are hypothetical estimates based on modified financial indicators and do not guarantee future outcomes.",
            "baseline": baseline_result,
            "simulated": simulated_result,
            "probability_delta": prob_delta,
            "risk_score_delta": risk_score_delta,
            "simulated_default_prob": simulated_result["default_probability"],
            "simulated_risk_score": simulated_result["risk_score"],
            "changes_applied": changes,
            "health_score_delta": -prob_delta,
            "risk_level_changed": baseline_result["risk_level"] != simulated_result["risk_level"],
            "summary_of_changes": changes or ["No financial parameters altered"]
        }
    except Exception as e:
        logger.error(f"Demo simulation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Demo simulation engine encountered an error."
        )
