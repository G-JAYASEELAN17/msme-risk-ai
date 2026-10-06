from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
import datetime

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    link: Optional[str] = None
    related_assessment_id: Optional[int] = None
    created_at: datetime.datetime

class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    rule_type: str = Field(..., description="e.g. high_risk_detected, probability_threshold")
    threshold: float = Field(..., ge=0, le=100)
    is_active: bool = True

class AlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    rule_type: str
    threshold: float
    is_active: bool
    created_at: datetime.datetime
