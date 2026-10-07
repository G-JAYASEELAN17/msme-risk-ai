from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any, Literal
import datetime

class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    business_name: str
    industry: str
    annual_revenue: Optional[float] = None
    created_at: datetime.datetime
    default_probability: float
    risk_level: str
    confidence: float
    review_status: str = "pending"
    review_notes: Optional[str] = None
    additional_comments: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime.datetime] = None

class AssessmentReviewRequest(BaseModel):
    review_status: Literal["pending", "in_review", "approved", "rejected", "needs_info"]
    review_notes: Optional[str] = Field(None, max_length=5000)
    additional_comments: Optional[str] = Field(None, max_length=5000)

class AnalystDashboardStatsResponse(BaseModel):
    total_assessments: int
    pending_reviews: int
    in_review_assessments: int
    completed_reviews: int
    low_risk_assessments: int
    medium_risk_assessments: int
    high_risk_assessments: int
    needs_info_assessments: int = 0

class PaginatedAssessmentsResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    pages: Optional[int] = None
    items: List[AssessmentResponse]

class IndustryRiskStat(BaseModel):
    industry: str
    count: int
    avg_default_probability: float
    low_risk_count: int
    medium_risk_count: int
    high_risk_count: int

class RevenueVsRiskPoint(BaseModel):
    id: int
    business_name: str
    industry: str
    annual_revenue: float
    existing_debt: float
    default_probability: float
    risk_level: str

class DashboardStatsResponse(BaseModel):
    total_businesses: int
    total_assessments: int
    completion_rate: float
    low_risk_count: int
    medium_risk_count: int
    high_risk_count: int
    avg_risk_score: float
    recent_assessments: List[AssessmentResponse]
    risk_distribution: List[Dict[str, Any]]  # [{"name": "Low Risk", "value": 10}, ...]
    assessment_trends: List[Dict[str, Any]]  # [{"date": "Sep 20", "count": 2}, ...]
    industry_comparison: List[IndustryRiskStat]
    revenue_vs_risk: List[RevenueVsRiskPoint]
