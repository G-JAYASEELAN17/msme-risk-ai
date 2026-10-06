from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any
import datetime

class BusinessCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: str = Field(..., min_length=1)
    location: Optional[str] = "United States"
    description: Optional[str] = None
    age: int = Field(..., ge=0)
    employees: int = Field(..., ge=1)

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    age: Optional[int] = Field(None, ge=0)
    employees: Optional[int] = Field(None, ge=1)

class BusinessAssessmentItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime.datetime
    annual_revenue: float
    monthly_cash_flow: float
    existing_debt: float
    default_probability: float
    risk_level: str
    confidence: float

class BusinessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    industry: str
    location: Optional[str] = None
    description: Optional[str] = None
    age: int
    employees: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    total_assessments: int = 0
    latest_risk_level: Optional[str] = None
    latest_default_probability: Optional[float] = None
    assessments: Optional[List[BusinessAssessmentItem]] = None

class AssessmentCompareResponse(BaseModel):
    business_id: int
    business_name: str
    assessment_1: Dict[str, Any]
    assessment_2: Dict[str, Any]
    deltas: Dict[str, Any]
    comparison_summary: List[str]
