from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
import datetime

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Dict[str, Any]
    created_at: datetime.datetime

class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    email_notifications: Optional[bool] = None
    risk_alert_threshold: Optional[float] = None
    onboarding_completed: Optional[bool] = None
    default_currency: Optional[str] = None

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    uid: str
    email: str
    name: Optional[str] = None
    role: str
    settings: Dict[str, Any]
    created_at: datetime.datetime

from typing import Literal

class UserRoleUpdate(BaseModel):
    role: Literal["user", "analyst", "admin"]

class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: str
    email: str
    name: Optional[str] = None
    role: str
    businesses_count: int
    assessments_count: int
    assessment_count: Optional[int] = None
    created_at: datetime.datetime

class AdminSystemStats(BaseModel):
    total_users: int
    total_businesses: int
    total_assessments: int
    total_documents: int
    pending_reviews: int = 0
    approved_assessments: int = 0
    rejected_assessments: int = 0
    needs_info_assessments: int = 0
    high_risk_assessments: int = 0
    role_distribution: Dict[str, int]
    risk_distribution: Dict[str, int]
    recent_audit_events_count: int
    recent_activity: List[Dict[str, Any]] = []

class PaginatedAuditLogsResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    limit: int
    total_pages: int
