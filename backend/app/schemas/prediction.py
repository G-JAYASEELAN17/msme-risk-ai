from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

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

class PredictionResponse(BaseModel):
    assessment_id: int
    default_probability: float
    risk_level: str
    confidence: float
    top_factors: List[str]
    positive_factors: List[str]
    risk_factors: List[str]

class SimulationRequest(BaseModel):
    assessment_id: Optional[int] = None
    baseline_data: Optional[PredictionRequest] = None
    simulated_annual_revenue: Optional[float] = None
    simulated_monthly_cash_flow: Optional[float] = None
    simulated_monthly_expenses: Optional[float] = None
    simulated_existing_debt: Optional[float] = None
    simulated_utility_score: Optional[float] = None
    simulated_invoice_score: Optional[float] = None
    simulated_defaults: Optional[int] = None

class PredictionResultOnly(BaseModel):
    default_probability: float
    risk_level: str
    confidence: float
    top_factors: List[str]
    positive_factors: List[str]
    risk_factors: List[str]

class SimulationResponse(BaseModel):
    is_hypothetical: bool = True
    disclaimer: str
    baseline: PredictionResultOnly
    simulated: PredictionResultOnly
    probability_delta: float
    health_score_delta: float
    risk_level_changed: bool
    summary_of_changes: List[str]
