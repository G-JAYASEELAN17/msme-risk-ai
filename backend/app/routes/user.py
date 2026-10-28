from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_
from typing import List, Optional, Literal
import uuid
import logging
from firebase_admin import auth as firebase_auth

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user, require_admin, verify_token_claims
from ..config import settings
from ..schemas.audit import (
    UserProfileResponse, 
    UserSettingsUpdate, 
    AuditLogResponse,
    UserRoleUpdate,
    AdminUserItem,
    AdminSystemStats,
    CheckEmailRequest,
    CheckEmailResponse,
    RegisterResponse,
    AnalystRejectRequest,
    AnalystAccessRequestItem
)
from ..services.audit_service import log_audit_event

logger = logging.getLogger("user_routes")

router = APIRouter()

@router.get("/me", response_model=UserProfileResponse)
def get_user_profile(
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns authenticated user profile, role, verification status, and persistent settings.
    """
    is_verified = getattr(current_user, "_token_email_verified", False) or (current_user.email_verified_at is not None)
    return UserProfileResponse(
        uid=current_user.uid,
        email=current_user.email,
        name=current_user.name,
        phone=current_user.phone,
        role=current_user.role or "user",
        approval_status=current_user.approval_status or "approved",
        email_verified=is_verified,
        organization=current_user.organization,
        qualifications=current_user.qualifications,
        experience_years=current_user.experience_years,
        application_reason=current_user.application_reason,
        rejection_reason=current_user.rejection_reason,
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
        phone=current_user.phone,
        role=current_user.role or "user",
        approval_status=current_user.approval_status or "approved",
        email_verified=getattr(current_user, "_token_email_verified", False) or (current_user.email_verified_at is not None),
        organization=current_user.organization,
        qualifications=current_user.qualifications,
        experience_years=current_user.experience_years,
        application_reason=current_user.application_reason,
        rejection_reason=current_user.rejection_reason,
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
    Optimized with SQL GROUP BY to eliminate N+1 queries.
    """
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()

    # Aggregate businesses per user in 1 query
    biz_counts_rows = (
        db.query(models.Business.user_id, func.count(models.Business.id))
        .group_by(models.Business.user_id)
        .all()
    )
    biz_counts = {uid: count for uid, count in biz_counts_rows}

    # Aggregate assessments per user in 1 query
    ass_counts_rows = (
        db.query(models.Business.user_id, func.count(models.Assessment.id))
        .join(models.Assessment, models.Assessment.business_id == models.Business.id)
        .group_by(models.Business.user_id)
        .all()
    )
    ass_counts = {uid: count for uid, count in ass_counts_rows}

    results = []
    for u in users:
        bus_count = biz_counts.get(u.uid, 0)
        ass_count = ass_counts.get(u.uid, 0)
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

    # Consolidated review status counts in a single query
    status_row = db.query(
        func.sum(case((models.Assessment.review_status == "pending", 1), else_=0)).label("pending"),
        func.sum(case((models.Assessment.review_status == "approved", 1), else_=0)).label("approved"),
        func.sum(case((models.Assessment.review_status == "rejected", 1), else_=0)).label("rejected"),
        func.sum(case((models.Assessment.review_status == "needs_info", 1), else_=0)).label("needs_info")
    ).one()

    pending_reviews = int(status_row.pending or 0)
    approved_assessments = int(status_row.approved or 0)
    rejected_assessments = int(status_row.rejected or 0)
    needs_info_assessments = int(status_row.needs_info or 0)

    # Role counts with SQL GROUP BY
    role_rows = (
        db.query(models.User.role, func.count(models.User.uid))
        .group_by(models.User.role)
        .all()
    )
    role_dist: dict[str, int] = {r or "user": count for r, count in role_rows}

    # Risk counts with SQL GROUP BY
    risk_rows = (
        db.query(models.Prediction.risk_level, func.count(models.Prediction.id))
        .group_by(models.Prediction.risk_level)
        .all()
    )
    risk_dist: dict[str, int] = {"Low": 0, "Medium": 0, "High": 0}
    high_risk_assessments = 0
    for lvl_raw, count in risk_rows:
        lvl = (lvl_raw or "Medium").capitalize()
        risk_dist[lvl] = risk_dist.get(lvl, 0) + count
        if (lvl_raw or "").upper() == "HIGH":
            high_risk_assessments += count

    # Recent assessment activity (eager load business name)
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
                user_id=log.user_id,
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

# ----------------- REGISTRATION & EMAIL VERIFICATION ENDPOINTS -----------------

@router.post("/check-email", response_model=CheckEmailResponse)
def check_email_availability(
    payload: CheckEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Checks if an email is already registered in Firebase or PostgreSQL.
    Returns clear guidance without leaking sensitive account details.
    """
    email_clean = payload.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid email address is required."
        )

    # 1. Check local database
    existing_user = db.query(models.User).filter(func.lower(models.User.email) == email_clean).first()
    if existing_user:
        return CheckEmailResponse(
            exists=True,
            message="An account with this email already exists. Please sign in or reset your password."
        )

    # 2. Check Firebase Authentication
    try:
        firebase_user = firebase_auth.get_user_by_email(email_clean)
        if firebase_user:
            return CheckEmailResponse(
                exists=True,
                message="An account with this email already exists. Please sign in or reset your password."
            )
    except Exception:
        # User not found in Firebase
        pass

    return CheckEmailResponse(exists=False, message=None)


from pydantic import BaseModel, Field

class UnifiedRegisterRequest(BaseModel):
    account_type: Optional[str] = None
    role: Optional[str] = None
    email: str
    password: str
    name: str
    phone: Optional[str] = None
    # MSME User Details
    business_name: Optional[str] = None
    industry: Optional[str] = None
    business_age: Optional[int] = 1
    employees: Optional[int] = 1
    # Analyst Application Details
    organization: Optional[str] = None
    qualifications: Optional[str] = None
    experience_years: Optional[str] = None
    application_reason: Optional[str] = None


@router.post("/register", response_model=RegisterResponse)
def register_account(
    payload: UnifiedRegisterRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Unified public registration endpoint for MSME Users and Credit Risk Analysts.
    - Never permits self-assignment of ADMIN role.
    - Checks for duplicate accounts in Firebase and PostgreSQL.
    - Supports frontend Firebase client account creation with genuine email verification.
    - Enforces Analyst registration approval workflow:
      State: PENDING_EMAIL_VERIFICATION -> PENDING_ADMIN_APPROVAL -> APPROVED -> ACTIVE.
    """
    raw_type = payload.role or payload.account_type
    if not raw_type:
        if payload.qualifications or payload.application_reason:
            raw_type = "analyst"
        else:
            raw_type = "user"
    account_type = raw_type.lower().strip()
    if account_type not in ["user", "analyst"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin and privileged roles cannot be self-assigned."
        )

    email_clean = payload.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid email address is required."
        )

    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least 6 characters."
        )

    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Full name is required."
        )

    # Validate role-specific requirements
    if account_type == "user":
        if not payload.business_name or not payload.business_name.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Business legal name is required for MSME registration."
            )
        if not payload.industry or not payload.industry.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Industry classification is required for MSME registration."
            )
    elif account_type == "analyst":
        if not payload.qualifications or not payload.qualifications.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Relevant professional qualifications are required for analyst applications."
            )
        if not payload.experience_years or not payload.experience_years.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Credit risk or financial analysis experience is required for analyst applications."
            )
        if not payload.application_reason or not payload.application_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Reason for requesting analyst access is required."
            )

    # Duplicate check in database
    existing_db_user = db.query(models.User).filter(func.lower(models.User.email) == email_clean).first()
    if existing_db_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in or reset your password."
        )

    # Inspect authorization header to verify if user was already created and authenticated by client SDK
    auth_header = request.headers.get("Authorization")
    caller_token_uid = None
    if auth_header and auth_header.startswith("Bearer "):
        token_str = auth_header[7:].strip()
        try:
            token_claims = verify_token_claims(token_str)
            if token_claims and token_claims.get("email", "").lower() == email_clean:
                caller_token_uid = token_claims.get("uid")
        except Exception:
            pass

    # Duplicate check in Firebase
    uid = None
    try:
        existing_fb_user = firebase_auth.get_user_by_email(email_clean)
        if existing_fb_user:
            # If caller owns this Firebase account (just created on client SDK), link it
            if caller_token_uid and caller_token_uid == existing_fb_user.uid:
                uid = existing_fb_user.uid
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists. Please sign in or reset your password."
                )
    except HTTPException:
        raise
    except Exception:
        # Not found in Firebase, proceed
        pass

    # Create account in Firebase Admin SDK if not created by client
    if not uid:
        try:
            fb_user = firebase_auth.create_user(
                email=email_clean,
                password=payload.password,
                display_name=name_clean,
                email_verified=False
            )
            uid = fb_user.uid
        except Exception as e:
            err_msg = str(e)
            if "EMAIL_EXISTS" in err_msg or "already in use" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists. Please sign in or reset your password."
                )
            if settings.ALLOW_TEST_AUTH:
                # Fallback mock UID for local testing without Firebase Service Account
                uid = f"usr_{uuid.uuid4().hex[:12]}"
            else:
                logger.error(f"Firebase user creation failed: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Authentication provider service unavailable. Please try again."
                )

    # Persist user record in PostgreSQL
    if account_type == "user":
        db_user = models.User(
            uid=uid,
            email=email_clean,
            name=name_clean,
            phone=payload.phone,
            role="user",
            approval_status="active",
            email_verified_at=None
        )
        db.add(db_user)

        # Create initial enterprise business record
        biz = models.Business(
            user_id=uid,
            name=payload.business_name.strip(),
            industry=payload.industry.strip(),
            age=max(0, payload.business_age or 1),
            employees=max(1, payload.employees or 1)
        )
        db.add(biz)
        approval_status_val = "active"
        resp_message = "MSME account created successfully. Please verify your email to access your dashboard."
    else:
        db_user = models.User(
            uid=uid,
            email=email_clean,
            name=name_clean,
            phone=payload.phone,
            role="analyst",
            approval_status="pending_email_verification",
            organization=payload.organization.strip() if payload.organization else None,
            qualifications=payload.qualifications.strip() if payload.qualifications else None,
            experience_years=payload.experience_years.strip() if payload.experience_years else None,
            application_reason=payload.application_reason.strip() if payload.application_reason else None,
            email_verified_at=None
        )
        db.add(db_user)
        approval_status_val = "pending_email_verification"
        resp_message = "Analyst application submitted successfully. Please verify your email. After verification, an administrator will review your application."

    try:
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        # Clean up Firebase account if database creation fails
        try:
            firebase_auth.delete_user(uid)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during account registration: {str(e)}"
        )

    # Log audit event
    log_audit_event(
        db=db,
        user_id=uid,
        action="REGISTER_USER" if account_type == "user" else "REGISTER_ANALYST_APPLICATION",
        resource_type="user",
        resource_id=uid,
        details={
            "email": email_clean,
            "role": account_type,
            "approval_status": approval_status_val
        }
    )

    return RegisterResponse(
        success=True,
        uid=uid,
        email=email_clean,
        name=name_clean,
        role=account_type,
        approval_status=approval_status_val,
        requires_email_verification=True,
        message=resp_message
    )

# ----------------- ADMIN ANALYST ACCESS REQUESTS ENDPOINTS -----------------

@router.get("/admin/analyst-requests", response_model=List[AnalystAccessRequestItem])
def get_analyst_access_requests(
    status_filter: Optional[str] = Query("ALL", alias="status"),
    search: Optional[str] = Query(None),
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Retrieve all Credit Risk Analyst access requests and review history.
    Filterable by approval status (ALL, pending, approved, rejected, suspended).
    """
    query = db.query(models.User).filter(models.User.role == "analyst")

    if status_filter and status_filter.upper() != "ALL":
        sf = status_filter.lower()
        if sf == "pending":
            query = query.filter(
                or_(
                    models.User.approval_status == "pending_email_verification",
                    models.User.approval_status == "pending_admin_approval"
                )
            )
        else:
            query = query.filter(models.User.approval_status == sf)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(models.User.name).like(term),
                func.lower(models.User.email).like(term),
                func.lower(models.User.organization).like(term)
            )
        )

    users = query.order_by(models.User.created_at.desc()).all()

    return [
        AnalystAccessRequestItem(
            uid=u.uid,
            email=u.email,
            name=u.name,
            phone=u.phone,
            organization=u.organization,
            qualifications=u.qualifications,
            experience_years=u.experience_years,
            application_reason=u.application_reason,
            approval_status=u.approval_status or "pending_admin_approval",
            email_verified=u.email_verified_at is not None,
            created_at=u.created_at,
            approved_by=u.approved_by,
            approved_at=u.approved_at,
            rejected_by=u.rejected_by,
            rejected_at=u.rejected_at,
            rejection_reason=u.rejection_reason,
            suspended_at=u.suspended_at
        )
        for u in users
    ]


@router.put("/admin/analyst-requests/{target_uid}/approve", response_model=UserProfileResponse)
def approve_analyst_request(
    target_uid: str,
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Approve a Credit Risk Analyst application.
    Transitions status to APPROVED / ACTIVE and records review audit history.
    Prevents administrators from approving themselves.
    """
    if admin_user.uid == target_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Administrators cannot approve their own application."
        )

    target_user = db.query(models.User).filter(models.User.uid == target_uid).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analyst with UID '{target_uid}' not found."
        )

    old_status = target_user.approval_status
    target_user.approval_status = "approved"
    target_user.role = "analyst"
    target_user.approved_by = admin_user.uid
    target_user.approved_at = datetime.datetime.utcnow()
    target_user.rejected_by = None
    target_user.rejected_at = None
    target_user.rejection_reason = None
    target_user.suspended_at = None

    db.commit()
    db.refresh(target_user)

    # Set Firebase custom claims if available
    try:
        firebase_auth.set_custom_user_claims(target_uid, {"role": "analyst", "approved": True})
    except Exception:
        pass

    log_audit_event(
        db=db,
        user_id=admin_user.uid,
        action="ANALYST_ACCESS_APPROVED",
        resource_type="user",
        resource_id=target_uid,
        details={
            "target_email": target_user.email,
            "previous_status": old_status,
            "approved_by": admin_user.uid,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    )

    return UserProfileResponse(
        uid=target_user.uid,
        email=target_user.email,
        name=target_user.name,
        phone=target_user.phone,
        role=target_user.role,
        approval_status=target_user.approval_status,
        email_verified=target_user.email_verified_at is not None,
        organization=target_user.organization,
        qualifications=target_user.qualifications,
        experience_years=target_user.experience_years,
        application_reason=target_user.application_reason,
        rejection_reason=target_user.rejection_reason,
        settings=target_user.settings or {},
        created_at=target_user.created_at
    )


@router.put("/admin/analyst-requests/{target_uid}/reject", response_model=UserProfileResponse)
def reject_analyst_request(
    target_uid: str,
    payload: AnalystRejectRequest,
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Reject a Credit Risk Analyst application.
    Requires an explicit rejection reason and logs audit event.
    """
    if admin_user.uid == target_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Administrators cannot reject their own application."
        )

    reason = payload.reason.strip() if payload.reason else ""
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A rejection reason is required."
        )

    target_user = db.query(models.User).filter(models.User.uid == target_uid).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analyst with UID '{target_uid}' not found."
        )

    old_status = target_user.approval_status
    target_user.approval_status = "rejected"
    target_user.rejected_by = admin_user.uid
    target_user.rejected_at = datetime.datetime.utcnow()
    target_user.rejection_reason = reason

    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db=db,
        user_id=admin_user.uid,
        action="ANALYST_ACCESS_REJECTED",
        resource_type="user",
        resource_id=target_uid,
        details={
            "target_email": target_user.email,
            "previous_status": old_status,
            "rejection_reason": reason,
            "rejected_by": admin_user.uid,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    )

    return UserProfileResponse(
        uid=target_user.uid,
        email=target_user.email,
        name=target_user.name,
        phone=target_user.phone,
        role=target_user.role,
        approval_status=target_user.approval_status,
        email_verified=target_user.email_verified_at is not None,
        organization=target_user.organization,
        qualifications=target_user.qualifications,
        experience_years=target_user.experience_years,
        application_reason=target_user.application_reason,
        rejection_reason=target_user.rejection_reason,
        settings=target_user.settings or {},
        created_at=target_user.created_at
    )


@router.put("/admin/analyst-requests/{target_uid}/suspend", response_model=UserProfileResponse)
def suspend_analyst_account(
    target_uid: str,
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Suspend an existing approved analyst account.
    """
    if admin_user.uid == target_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Administrators cannot suspend their own account."
        )

    target_user = db.query(models.User).filter(models.User.uid == target_uid).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with UID '{target_uid}' not found."
        )

    target_user.approval_status = "suspended"
    target_user.suspended_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db=db,
        user_id=admin_user.uid,
        action="ANALYST_ACCESS_SUSPENDED",
        resource_type="user",
        resource_id=target_uid,
        details={"suspended_by": admin_user.uid}
    )

    return UserProfileResponse(
        uid=target_user.uid,
        email=target_user.email,
        name=target_user.name,
        phone=target_user.phone,
        role=target_user.role,
        approval_status=target_user.approval_status,
        email_verified=target_user.email_verified_at is not None,
        organization=target_user.organization,
        qualifications=target_user.qualifications,
        experience_years=target_user.experience_years,
        application_reason=target_user.application_reason,
        rejection_reason=target_user.rejection_reason,
        settings=target_user.settings or {},
        created_at=target_user.created_at
    )


@router.put("/admin/analyst-requests/{target_uid}/reactivate", response_model=UserProfileResponse)
def reactivate_analyst_account(
    target_uid: str,
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Reactivate an eligible suspended analyst account.
    """
    target_user = db.query(models.User).filter(models.User.uid == target_uid).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with UID '{target_uid}' not found."
        )

    target_user.approval_status = "approved"
    target_user.suspended_at = None
    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db=db,
        user_id=admin_user.uid,
        action="ANALYST_ACCESS_REACTIVATED",
        resource_type="user",
        resource_id=target_uid,
        details={"reactivated_by": admin_user.uid}
    )

    return UserProfileResponse(
        uid=target_user.uid,
        email=target_user.email,
        name=target_user.name,
        phone=target_user.phone,
        role=target_user.role,
        approval_status=target_user.approval_status,
        email_verified=target_user.email_verified_at is not None,
        organization=target_user.organization,
        qualifications=target_user.qualifications,
        experience_years=target_user.experience_years,
        application_reason=target_user.application_reason,
        rejection_reason=target_user.rejection_reason,
        settings=target_user.settings or {},
        created_at=target_user.created_at
    )

