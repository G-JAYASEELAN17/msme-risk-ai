from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user, require_admin
from ..schemas.audit import (
    UserProfileResponse, 
    UserSettingsUpdate, 
    AuditLogResponse,
    UserRoleUpdate,
    AdminUserItem,
    AdminSystemStats
)
from ..services.audit_service import log_audit_event

router = APIRouter()

@router.get("/me", response_model=UserProfileResponse)
def get_user_profile(
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns authenticated user profile, role, and persistent settings.
    """
    return UserProfileResponse(
        uid=current_user.uid,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role or "analyst",
        settings=current_user.settings or {},
        created_at=current_user.created_at
    )

@router.put("/settings", response_model=UserProfileResponse)
def update_user_settings(
    payload: UserSettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Persists user preferences (theme, notification flags, onboarding status).
    """
    current_settings = dict(current_user.settings or {})

    if payload.theme is not None:
        current_settings["theme"] = payload.theme
    if payload.email_notifications is not None:
        current_settings["email_notifications"] = payload.email_notifications
    if payload.risk_alert_threshold is not None:
        current_settings["risk_alert_threshold"] = payload.risk_alert_threshold
    if payload.onboarding_completed is not None:
        current_settings["onboarding_completed"] = payload.onboarding_completed
    if payload.default_currency is not None:
        current_settings["default_currency"] = payload.default_currency

    current_user.settings = current_settings
    db.commit()
    db.refresh(current_user)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="UPDATE_SETTINGS",
        resource_type="user",
        resource_id=current_user.uid,
        details={"updated_keys": list(current_settings.keys())}
    )

    return UserProfileResponse(
        uid=current_user.uid,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role or "analyst",
        settings=current_user.settings,
        created_at=current_user.created_at
    )

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_user_audit_logs(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns audit log history for the authenticated user (or all if admin).
    """
    query = db.query(models.AuditLog)

    if (current_user.role or "").lower() != "admin":
        query = query.filter(models.AuditLog.user_id == current_user.uid)

    logs = query.order_by(models.AuditLog.created_at.desc()).limit(100).all()
    return logs

# ----------------- ADMIN PROTECTED ENDPOINTS -----------------

import math
import datetime

@router.get("/admin/users", response_model=List[AdminUserItem])
def get_admin_users_list(
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Retrieve all registered platform users, roles, and resource counts.
    """
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    results = []

    for u in users:
        bus_count = db.query(models.Business).filter(models.Business.user_id == u.uid).count()
        ass_count = (
            db.query(models.Assessment)
            .join(models.Business)
            .filter(models.Business.user_id == u.uid)
            .count()
        )
        results.append(AdminUserItem(
            uid=u.uid,
            email=u.email,
            name=u.name,
            role=u.role or "user",
            businesses_count=bus_count,
            assessments_count=ass_count,
            assessment_count=ass_count,
            created_at=u.created_at
        ))

    return results

@router.put("/admin/users/{target_uid}/role", response_model=UserProfileResponse)
def update_user_role(
    target_uid: str,
    payload: UserRoleUpdate,
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Update a user's role (user, analyst, admin).
    Strictly protected against unauthorized escalation and self-role modifications.
    """
    allowed_roles = ["user", "analyst", "admin"]
    new_role = payload.role.lower().strip()

    if new_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{new_role}'. Must be one of: {', '.join(allowed_roles)}"
        )

    # Prevent administrators from modifying their own role
    if admin_user.uid == target_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Administrators cannot change their own role."
        )

    target_user = db.query(models.User).filter(models.User.uid == target_uid).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with UID '{target_uid}' not found."
        )

    old_role = target_user.role or "user"
    target_user.role = new_role
    db.commit()
    db.refresh(target_user)

    # Record immutable audit events (ROLE_CHANGED and UPDATE_USER_ROLE for backwards compatibility)
    log_audit_event(
        db=db,
        user_id=admin_user.uid,
        action="ROLE_CHANGED",
        resource_type="user",
        resource_id=target_uid,
        details={
            "target_user_id": target_uid,
            "target_user_email": target_user.email,
            "previous_role": old_role,
            "new_role": new_role,
            "administrator_id": admin_user.uid,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    )
    log_audit_event(
        db=db,
        user_id=admin_user.uid,
        action="UPDATE_USER_ROLE",
        resource_type="user",
        resource_id=target_uid,
        details={
            "target_user_email": target_user.email,
            "previous_role": old_role,
            "assigned_role": new_role
        }
    )

    return UserProfileResponse(
        uid=target_user.uid,
        email=target_user.email,
        name=target_user.name,
        role=target_user.role,
        settings=target_user.settings or {},
        created_at=target_user.created_at
    )

@router.get("/admin/stats", response_model=AdminSystemStats)
def get_admin_system_stats(
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Real database platform metrics, review pipeline breakdown, and risk statistics.
    """
    total_users = db.query(models.User).count()
    total_businesses = db.query(models.Business).count()
    total_assessments = db.query(models.Assessment).count()
    total_documents = db.query(models.Document).count()
    recent_audit_count = db.query(models.AuditLog).count()

    # Real review status counts
    pending_reviews = db.query(models.Assessment).filter(models.Assessment.review_status == "pending").count()
    approved_assessments = db.query(models.Assessment).filter(models.Assessment.review_status == "approved").count()
    rejected_assessments = db.query(models.Assessment).filter(models.Assessment.review_status == "rejected").count()
    needs_info_assessments = db.query(models.Assessment).filter(models.Assessment.review_status == "needs_info").count()
    high_risk_assessments = db.query(models.Prediction).filter(models.Prediction.risk_level.ilike("HIGH")).count()

    # Role counts
    users = db.query(models.User).all()
    role_dist: dict[str, int] = {}
    for u in users:
        r = u.role or "user"
        role_dist[r] = role_dist.get(r, 0) + 1

    # Risk counts
    predictions = db.query(models.Prediction).all()
    risk_dist: dict[str, int] = {"Low": 0, "Medium": 0, "High": 0}
    for p in predictions:
        lvl = (p.risk_level or "Medium").capitalize()
        risk_dist[lvl] = risk_dist.get(lvl, 0) + 1

    # Recent assessment activity
    recent_assessments = (
        db.query(models.Assessment)
        .order_by(models.Assessment.created_at.desc())
        .limit(5)
        .all()
    )
    recent_activity = [
        {
            "id": a.id,
            "business_name": a.business.name if a.business else f"MSME #{a.id}",
            "review_status": a.review_status or "pending",
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in recent_assessments
    ]

    return AdminSystemStats(
        total_users=total_users,
        total_businesses=total_businesses,
        total_assessments=total_assessments,
        total_documents=total_documents,
        pending_reviews=pending_reviews,
        approved_assessments=approved_assessments,
        rejected_assessments=rejected_assessments,
        needs_info_assessments=needs_info_assessments,
        high_risk_assessments=high_risk_assessments,
        role_distribution=role_dist,
        risk_distribution=risk_dist,
        recent_audit_events_count=recent_audit_count,
        recent_activity=recent_activity
    )

@router.get("/admin/audit-logs")
def get_admin_audit_logs(
    action: Optional[str] = None,
    actor: Optional[str] = None,
    assessment_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Paginated audit trail retrieval with action, actor, date range, and resource filters.
    """
    query = db.query(models.AuditLog)

    if action:
        query = query.filter(models.AuditLog.action.ilike(f"%{action.strip()}%"))
    if actor:
        query = query.filter(models.AuditLog.user_id == actor.strip())
    if assessment_id:
        query = query.filter(
            (models.AuditLog.resource_id == assessment_id.strip()) &
            (models.AuditLog.resource_type == "assessment")
        )
    if date_from:
        try:
            dt_from = datetime.datetime.fromisoformat(date_from.strip())
            query = query.filter(models.AuditLog.created_at >= dt_from)
        except Exception:
            pass
    if date_to:
        try:
            dt_to = datetime.datetime.fromisoformat(date_to.strip())
            query = query.filter(models.AuditLog.created_at <= dt_to)
        except Exception:
            pass

    total = query.count()
    safe_limit = max(1, min(limit, 100))
    safe_page = max(1, page)
    offset = (safe_page - 1) * safe_limit
    total_pages = math.ceil(total / safe_limit) if safe_limit > 0 else 1

    logs = query.order_by(models.AuditLog.created_at.desc()).offset(offset).limit(safe_limit).all()

    return {
        "items": [
            AuditLogResponse(
                id=log.id,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                details=log.details or {},
                created_at=log.created_at
            )
            for log in logs
        ],
        "total": total,
        "page": safe_page,
        "limit": safe_limit,
        "total_pages": total_pages
    }
