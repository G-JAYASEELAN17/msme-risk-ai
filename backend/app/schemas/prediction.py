from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import datetime

class PredictionRequest(BaseModel):
    name: str = Field(..., description="Business name")
    industry: str = Field(..., description="Industry type")
    age: int = Field(..., ge=0, description="Business age in years")
    employees: int = Field(..., ge=1, description="Number of employees")
    annual_revenue: float = Field(..., ge=0, description="Annual revenue USD")
    monthly_cash_flow: float = Field(..., description="Monthly cash flow USD")
    monthly_expenses: float = Field(..., ge=0, description="Monthly expenses USD")
    existing_debt: float = Field(..., ge=0, description="Existing debt USD")
    digital_transactions: int = Field(..., ge=0, description="Digital transactions per month")
    utility_payment_score: float = Field(..., ge=0, le=100, description="Utility payment history score 0-100")
    invoice_payment_score: float = Field(..., ge=0, le=100, description="Invoice payment history score 0-100")
    previous_defaults: int = Field(..., ge=0, description="Previous loan defaults count")
    loan_amount: Optional[float] = Field(None, ge=0, description="Requested or active loan principal")
    loan_tenure: Optional[int] = Field(None, ge=0, description="Loan tenure in months")

class PredictionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    assessment_id: int
    default_probability: float
    risk_level: str
    risk_score: float = 0.0
    confidence: float
    data_quality_score: float = 100.0
    data_quality_tier: str = "High Quality"
    model_version: str = "1.1.0"
    top_factors: List[str]
    positive_factors: List[str]
    risk_factors: List[str]
    factor_breakdown: Optional[Dict[str, Any]] = None
    analyst_summary: Optional[str] = None

class SimulationRequest(BaseModel):
    assessment_id: Optional[int] = None
    baseline_data: Optional[PredictionRequest] = None
    simulated_annual_revenue: Optional[float] = None
    simulated_monthly_cash_flow: Optional[float] = None
    simulated_monthly_expenses: Optional[float] = None
    simulated_existing_debt: Optional[float] = None
    simulated_loan_amount: Optional[float] = None
    simulated_loan_tenure: Optional[int] = None
    simulated_digital_transactions: Optional[int] = None
    simulated_utility_score: Optional[float] = None
    simulated_invoice_score: Optional[float] = None
    simulated_defaults: Optional[int] = None

class PredictionResultOnly(BaseModel):
    model_config = {"protected_namespaces": ()}
    default_probability: float
    risk_level: str
    risk_score: float = 0.0
    confidence: float
    top_factors: List[str]
    positive_factors: List[str]
    risk_factors: List[str]
    data_quality_score: Optional[float] = None
    model_version: Optional[str] = None

class SimulationResponse(BaseModel):
    is_hypothetical: bool = True
    disclaimer: str = "Scenario results are hypothetical estimates based on modified financial indicators and do not guarantee future outcomes."
    baseline: PredictionResultOnly
    simulated: PredictionResultOnly
    probability_delta: float
    health_score_delta: float
    risk_level_changed: bool
    summary_of_changes: List[str]

class PredictionHistoryItem(BaseModel):
    model_config = {"protected_namespaces": ()}
    prediction_id: int
    assessment_id: int
    business_name: str
    industry: str
    default_probability: float
    risk_level: str
    risk_score: float
    confidence: float
    data_quality_score: float
    model_version: str
    created_at: datetime.datetime

class RiskTrendResponse(BaseModel):
    assessment_id: int
    business_name: str
    current_probability: float
    previous_probability: Optional[float] = None
    trend: str  # IMPROVING | STABLE | INCREASING_RISK
    trend_label: str
    delta: float
    description: str

class PredictionExplanationResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    prediction_id: int
    assessment_id: int
    business_name: str
    default_probability: float
    risk_level: str
    risk_score: float
    confidence: float
    model_confidence_label: str = "Model confidence indicator"
    data_quality_score: float
    data_quality_tier: str
    model_version: str
    top_factors: List[str]
    positive_factors: List[str]
    risk_factors: List[str]
    factor_breakdown: Dict[str, Any]
    analyst_summary: str
    disclaimer: str = "This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans."
