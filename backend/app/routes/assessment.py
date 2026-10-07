from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user, require_analyst
from ..schemas.assessment import (
    AssessmentResponse, 
    DashboardStatsResponse, 
    IndustryRiskStat, 
    RevenueVsRiskPoint,
    AssessmentReviewRequest,
    AnalystDashboardStatsResponse
)
from ..schemas.business import AssessmentCompareResponse
from ..services.audit_service import log_audit_event

router = APIRouter()

@router.post("", response_model=AssessmentResponse)
def create_assessment(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Use POST /api/predict to submit assessments and generate predictions."
    )

import math

@router.get("/analyst/dashboard", response_model=AnalystDashboardStatsResponse)
def get_analyst_dashboard_stats(
    analyst_user: models.User = Depends(require_analyst),
    db: Session = Depends(get_db)
):
    """
    Analyst/Admin only: Portfolio-wide review queue metrics and risk category distribution.
    """
    total = db.query(models.Assessment).count()
    pending = db.query(models.Assessment).filter(models.Assessment.review_status == "pending").count()
    in_review = db.query(models.Assessment).filter(models.Assessment.review_status == "in_review").count()
    completed = db.query(models.Assessment).filter(models.Assessment.review_status.in_(["approved", "rejected"])).count()
    needs_info = db.query(models.Assessment).filter(models.Assessment.review_status == "needs_info").count()
    
    low = db.query(models.Prediction).filter(models.Prediction.risk_level.ilike("LOW")).count()
    med = db.query(models.Prediction).filter(models.Prediction.risk_level.ilike("MEDIUM")).count()
    high = db.query(models.Prediction).filter(models.Prediction.risk_level.ilike("HIGH")).count()

    return AnalystDashboardStatsResponse(
        total_assessments=total,
        pending_reviews=pending,
        in_review_assessments=in_review,
        completed_reviews=completed,
        low_risk_assessments=low,
        medium_risk_assessments=med,
        high_risk_assessments=high,
        needs_info_assessments=needs_info
    )

@router.get("")
def get_assessments(
    q: Optional[str] = Query(None, description="Search by business name or assessment ID"),
    risk_level: Optional[str] = Query(None, description="Filter by LOW, MEDIUM, HIGH"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    review_status: Optional[str] = Query(None, description="Filter by pending, in_review, approved, rejected, needs_info"),
    business_name: Optional[str] = Query(None, description="Filter by business name"),
    date_from: Optional[str] = Query(None, description="Filter from date (ISO)"),
    date_to: Optional[str] = Query(None, description="Filter to date (ISO)"),
    sort_by: Optional[str] = Query("created_at", description="created_at, default_probability, business_name, annual_revenue"),
    sort_order: Optional[str] = Query("desc", description="asc or desc"),
    page: Optional[int] = Query(None, ge=1, description="Page number (1-indexed)"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Items per page (max 100)"),
    all_users: Optional[bool] = Query(False, description="Analyst/Admin only: view portfolio assessments across all users"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves assessments with advanced filtering, searching, whitelist sorting, and optional server-side pagination.
    Strictly isolated to current user unless an Analyst/Admin explicitly requests all_users.
    """
    user_role = (current_user.role or "user").lower()
    
    query = db.query(
        models.Assessment.id,
        models.Business.name.label("business_name"),
        models.Business.industry,
        models.Assessment.created_at,
        models.Assessment.annual_revenue,
        models.Prediction.default_probability,
        models.Prediction.risk_level,
        models.Prediction.confidence,
        models.Assessment.review_status,
        models.Assessment.review_notes,
        models.Assessment.additional_comments,
        models.Assessment.reviewed_by,
        models.Assessment.reviewed_at
    ).join(
        models.Business, models.Assessment.business_id == models.Business.id
    ).join(
        models.Prediction, models.Prediction.assessment_id == models.Assessment.id
    )

    # Multi-tenant isolation: default to user's own assessments
    if not (all_users and user_role in ["analyst", "admin"]):
        query = query.filter(models.Business.user_id == current_user.uid)

    # Search filter (business name, industry, or assessment ID)
    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        if q.strip().isdigit():
            query = query.filter(
                (models.Assessment.id == int(q.strip())) |
                (models.Business.name.ilike(search_pattern)) | 
                (models.Business.industry.ilike(search_pattern))
            )
        else:
            query = query.filter(
                (models.Business.name.ilike(search_pattern)) | 
                (models.Business.industry.ilike(search_pattern))
            )

    # Business name explicit filter
    if business_name and business_name.strip():
        query = query.filter(models.Business.name.ilike(f"%{business_name.strip()}%"))

    # Date range filters
    if date_from and date_from.strip():
        try:
            dt_from = datetime.datetime.fromisoformat(date_from.strip())
            query = query.filter(models.Assessment.created_at >= dt_from)
        except Exception:
            pass

    if date_to and date_to.strip():
        try:
            dt_to = datetime.datetime.fromisoformat(date_to.strip())
            query = query.filter(models.Assessment.created_at <= dt_to)
        except Exception:
            pass

    # Risk level filter
    if risk_level and risk_level.upper() != "ALL":
        query = query.filter(models.Prediction.risk_level.ilike(risk_level.strip()))

    # Industry filter
    if industry and industry.upper() != "ALL":
        query = query.filter(models.Business.industry.ilike(industry.strip()))

    # Review status filter
    if review_status and review_status.upper() != "ALL":
        query = query.filter(models.Assessment.review_status == review_status.lower().strip())

    # Whitelist mapping for sortable fields
    sort_fields = {
        "created_at": models.Assessment.created_at,
        "default_probability": models.Prediction.default_probability,
        "business_name": models.Business.name,
        "annual_revenue": models.Assessment.annual_revenue
    }
    sort_column = sort_fields.get((sort_by or "created_at").lower(), models.Assessment.created_at)
    is_asc = (sort_order or "desc").lower() == "asc"
    query = query.order_by(sort_column.asc() if is_asc else sort_column.desc())

    # Server-side pagination if requested
    if page is not None or limit is not None:
        safe_page = page or 1
        safe_limit = max(1, min(limit or 20, 100))
        total = query.count()
        total_pages = math.ceil(total / safe_limit) if safe_limit > 0 else 1
        offset = (safe_page - 1) * safe_limit

        results = query.offset(offset).limit(safe_limit).all()
        items = [
            AssessmentResponse(
                id=r.id,
                business_name=r.business_name,
                industry=r.industry,
                annual_revenue=r.annual_revenue,
                created_at=r.created_at,
                default_probability=r.default_probability,
                risk_level=r.risk_level,
                confidence=r.confidence,
                review_status=r.review_status or "pending",
                review_notes=r.review_notes,
                additional_comments=getattr(r, "additional_comments", None),
                reviewed_by=r.reviewed_by,
                reviewed_at=r.reviewed_at
            ) for r in results
        ]
        return {
            "items": items,
            "page": safe_page,
            "limit": safe_limit,
            "total": total,
            "total_pages": total_pages,
            "pages": total_pages
        }

    # Unpaginated response for backwards compatibility
    results = query.all()
    return [
        AssessmentResponse(
            id=r.id,
            business_name=r.business_name,
            industry=r.industry,
            annual_revenue=r.annual_revenue,
            created_at=r.created_at,
            default_probability=r.default_probability,
            risk_level=r.risk_level,
            confidence=r.confidence,
            review_status=r.review_status or "pending",
            review_notes=r.review_notes,
            additional_comments=getattr(r, "additional_comments", None),
            reviewed_by=r.reviewed_by,
            reviewed_at=r.reviewed_at
        ) for r in results
    ]

@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    range_param: Optional[str] = Query("7d", alias="range", description="7d, 30d, 90d, custom"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.datetime.utcnow()
    filter_start = None
    filter_end = now

    if range_param == "7d":
        filter_start = now - datetime.timedelta(days=7)
    elif range_param == "30d":
        filter_start = now - datetime.timedelta(days=30)
    elif range_param == "90d":
        filter_start = now - datetime.timedelta(days=90)
    elif range_param == "custom" and start_date:
        try:
            filter_start = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            if end_date:
                filter_end = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
        except ValueError:
            filter_start = now - datetime.timedelta(days=7)

    base_query = db.query(
        models.Assessment.id,
        models.Assessment.business_id,
        models.Assessment.annual_revenue,
        models.Assessment.existing_debt,
        models.Business.name.label("business_name"),
        models.Business.industry,
        models.Assessment.created_at,
        models.Prediction.default_probability,
        models.Prediction.risk_level,
        models.Prediction.confidence,
        models.Assessment.review_status,
        models.Assessment.review_notes
    ).join(
        models.Business, models.Assessment.business_id == models.Business.id
    ).join(
        models.Prediction, models.Prediction.assessment_id == models.Assessment.id
    ).filter(
        models.Business.user_id == current_user.uid
    )

    if filter_start:
        base_query = base_query.filter(
            models.Assessment.created_at >= filter_start,
            models.Assessment.created_at <= filter_end
        )

    all_records = base_query.order_by(models.Assessment.created_at.desc()).all()

    total_assessments = len(all_records)
    total_businesses = db.query(models.Business).filter(models.Business.user_id == current_user.uid).count()

    low_count = sum(1 for r in all_records if r.risk_level.upper() == "LOW")
    med_count = sum(1 for r in all_records if r.risk_level.upper() == "MEDIUM")
    high_count = sum(1 for r in all_records if r.risk_level.upper() == "HIGH")

    avg_score = (
        sum(r.default_probability for r in all_records) / total_assessments
        if total_assessments > 0 else 0.0
    )

    recent_assessments = [
        AssessmentResponse(
            id=r.id,
            business_name=r.business_name,
            industry=r.industry,
            created_at=r.created_at,
            default_probability=r.default_probability,
            risk_level=r.risk_level,
            confidence=r.confidence,
            review_status=r.review_status or "pending",
            review_notes=r.review_notes
        ) for r in all_records[:5]
    ]

    risk_distribution = [
        {"name": "Low Risk", "value": low_count},
        {"name": "Medium Risk", "value": med_count},
        {"name": "High Risk", "value": high_count},
    ]

    # Trends grouping by date
    trends_map = {}
    num_days = 7 if range_param == "7d" else 30 if range_param == "30d" else 90
    for i in range(num_days - 1, -1, -1):
        d_str = (now - datetime.timedelta(days=i)).strftime("%b %d")
        trends_map[d_str] = 0

    for r in all_records:
        d_str = r.created_at.strftime("%b %d")
        if d_str in trends_map:
            trends_map[d_str] += 1

    assessment_trends = [{"date": k, "count": v} for k, v in trends_map.items()]

    # Industry comparison breakdown
    industry_map = {}
    for r in all_records:
        ind = r.industry or "General"
        if ind not in industry_map:
            industry_map[ind] = {
                "count": 0,
                "prob_sum": 0.0,
                "low": 0,
                "med": 0,
                "high": 0
            }
        industry_map[ind]["count"] += 1
        industry_map[ind]["prob_sum"] += r.default_probability
        lvl = r.risk_level.upper()
        if lvl == "LOW":
            industry_map[ind]["low"] += 1
        elif lvl == "MEDIUM":
            industry_map[ind]["med"] += 1
        elif lvl == "HIGH":
            industry_map[ind]["high"] += 1

    industry_comparison = [
        IndustryRiskStat(
            industry=k,
            count=v["count"],
            avg_default_probability=v["prob_sum"] / v["count"] if v["count"] > 0 else 0.0,
            low_risk_count=v["low"],
            medium_risk_count=v["med"],
            high_risk_count=v["high"]
        )
        for k, v in industry_map.items()
    ]

    revenue_vs_risk = [
        RevenueVsRiskPoint(
            id=r.id,
            business_name=r.business_name,
            industry=r.industry,
            annual_revenue=r.annual_revenue,
            existing_debt=r.existing_debt,
            default_probability=r.default_probability,
            risk_level=r.risk_level
        )
        for r in all_records[:30]
    ]

    return DashboardStatsResponse(
        total_businesses=total_businesses,
        total_assessments=total_assessments,
        completion_rate=100.0 if total_assessments > 0 else 0.0,
        low_risk_count=low_count,
        medium_risk_count=med_count,
        high_risk_count=high_count,
        avg_risk_score=avg_score,
        recent_assessments=recent_assessments,
        risk_distribution=risk_distribution,
        assessment_trends=assessment_trends,
        industry_comparison=industry_comparison,
        revenue_vs_risk=revenue_vs_risk
    )

@router.get("/compare", response_model=AssessmentCompareResponse)
def compare_assessments(
    id1: int = Query(..., description="First assessment ID"),
    id2: int = Query(..., description="Second assessment ID"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_role = (current_user.role or "user").lower()
    
    ass1 = db.query(models.Assessment).filter(models.Assessment.id == id1).first()
    ass2 = db.query(models.Assessment).filter(models.Assessment.id == id2).first()

    if not ass1 or not ass2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both assessments not found."
        )

    if user_role not in ["analyst", "admin"]:
        if ass1.business.user_id != current_user.uid or ass2.business.user_id != current_user.uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to compare assessments from other users."
            )

    pred1 = ass1.prediction
    pred2 = ass2.prediction

    prob_delta = pred2.default_probability - pred1.default_probability
    health_delta = (100 - pred2.default_probability) - (100 - pred1.default_probability)
    rev_delta = ass2.annual_revenue - ass1.annual_revenue
    cf_delta = ass2.monthly_cash_flow - ass1.monthly_cash_flow
    debt_delta = ass2.existing_debt - ass1.existing_debt
    risk_changed = pred1.risk_level.upper() != pred2.risk_level.upper()

    summary_bullets = []
    if prob_delta < 0:
        summary_bullets.append(f"Default risk improved by {abs(prob_delta):.1f}% (Health Score +{abs(health_delta):.1f}).")
    elif prob_delta > 0:
        summary_bullets.append(f"Default risk increased by {prob_delta:.1f}% (Health Score -{abs(health_delta):.1f}).")
    else:
        summary_bullets.append("Default risk remained identical between assessment cycles.")

    if rev_delta > 0:
        summary_bullets.append(f"Annual revenue grew by ${rev_delta:,.0f}.")
    elif rev_delta < 0:
        summary_bullets.append(f"Annual revenue contracted by ${abs(rev_delta):,.0f}.")

    if debt_delta < 0:
        summary_bullets.append(f"Total liabilities decreased by ${abs(debt_delta):,.0f} (Deleveraging).")
    elif debt_delta > 0:
        summary_bullets.append(f"Total liabilities expanded by ${debt_delta:,.0f}.")

    return AssessmentCompareResponse(
        business_id=ass1.business_id,
        business_name=ass1.business.name,
        assessment_1={
            "id": ass1.id,
            "created_at": ass1.created_at.isoformat(),
            "default_probability": pred1.default_probability,
            "risk_level": pred1.risk_level,
            "annual_revenue": ass1.annual_revenue,
            "monthly_cash_flow": ass1.monthly_cash_flow,
            "existing_debt": ass1.existing_debt,
            "utility_payment_score": ass1.utility_payment_score,
            "invoice_payment_score": ass1.invoice_payment_score,
        },
        assessment_2={
            "id": ass2.id,
            "created_at": ass2.created_at.isoformat(),
            "default_probability": pred2.default_probability,
            "risk_level": pred2.risk_level,
            "annual_revenue": ass2.annual_revenue,
            "monthly_cash_flow": ass2.monthly_cash_flow,
            "existing_debt": ass2.existing_debt,
            "utility_payment_score": ass2.utility_payment_score,
            "invoice_payment_score": ass2.invoice_payment_score,
        },
        deltas={
            "default_probability_delta": prob_delta,
            "health_score_delta": health_delta,
            "annual_revenue_delta": rev_delta,
            "monthly_cash_flow_delta": cf_delta,
            "existing_debt_delta": debt_delta,
            "risk_level_changed": risk_changed,
        },
        comparison_summary=summary_bullets
    )

@router.put("/{id}/review", response_model=AssessmentResponse)
def review_assessment(
    id: int,
    payload: AssessmentReviewRequest,
    analyst_user: models.User = Depends(require_analyst),
    db: Session = Depends(get_db)
):
    """
    Analyst/Admin only: Update the review status (pending, in_review, approved, rejected, needs_info) and review notes.
    Dispatches a notification to the borrower and logs the audit event.
    """
    allowed_statuses = ["pending", "in_review", "approved", "rejected", "needs_info"]
    new_status = payload.review_status.lower().strip()

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid review status '{new_status}'. Allowed: {', '.join(allowed_statuses)}"
        )

    assessment = db.query(models.Assessment).filter(models.Assessment.id == id).first()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found."
        )

    assessment.review_status = new_status
    if payload.review_notes is not None:
        assessment.review_notes = payload.review_notes
    if payload.additional_comments is not None:
        assessment.additional_comments = payload.additional_comments
    assessment.reviewed_by = analyst_user.uid
    assessment.reviewed_at = datetime.datetime.utcnow()

    db.flush()

    # Dispatch notification to business owner
    if new_status == "in_review":
        notification = models.Notification(
            user_id=assessment.business.user_id,
            title=f"Assessment In Review: {assessment.business.name}",
            message="Your MSME assessment is now under review by an analyst.",
            type="info",
            link=f"/reports?id={assessment.id}",
            related_assessment_id=assessment.id
        )
        db.add(notification)
    elif new_status == "needs_info":
        notes_snippet = f" Notes: {payload.review_notes}" if payload.review_notes else ""
        notification = models.Notification(
            user_id=assessment.business.user_id,
            title=f"Additional Information Requested: {assessment.business.name}",
            message=f"Additional information has been requested for your assessment.{notes_snippet}",
            type="warning",
            link=f"/reports?id={assessment.id}",
            related_assessment_id=assessment.id
        )
        db.add(notification)
    elif new_status in ["approved", "rejected"]:
        status_label = "APPROVED" if new_status == "approved" else "REJECTED"
        notif_type = "alert" if new_status == "rejected" else "success"
        notes_snippet = f" Notes: {payload.review_notes}" if payload.review_notes else ""
        notification = models.Notification(
            user_id=assessment.business.user_id,
            title=f"Assessment Review: {assessment.business.name}",
            message=f"Your MSME assessment has been reviewed. Status: {status_label}.{notes_snippet}",
            type=notif_type,
            link=f"/reports?id={assessment.id}",
            related_assessment_id=assessment.id
        )
        db.add(notification)

    # Log immutable audit events
    log_audit_event(
        db=db,
        user_id=analyst_user.uid,
        action="REVIEW_ASSESSMENT",
        resource_type="assessment",
        resource_id=str(assessment.id),
        details={
            "review_status": new_status,
            "business_name": assessment.business.name,
            "has_notes": bool(payload.review_notes),
            "reviewed_by": analyst_user.uid
        },
        commit=False
    )
    if new_status == "in_review":
        log_audit_event(
            db=db,
            user_id=analyst_user.uid,
            action="ASSESSMENT_REVIEW_STARTED",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={"business_name": assessment.business.name, "reviewed_by": analyst_user.uid},
            commit=False
        )
    elif new_status == "needs_info":
        log_audit_event(
            db=db,
            user_id=analyst_user.uid,
            action="ASSESSMENT_INFO_REQUESTED",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={"business_name": assessment.business.name, "notes": payload.review_notes},
            commit=False
        )
    elif new_status == "approved":
        log_audit_event(
            db=db,
            user_id=analyst_user.uid,
            action="ASSESSMENT_APPROVED",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={"business_name": assessment.business.name, "decision": "approved"},
            commit=False
        )
        log_audit_event(
            db=db,
            user_id=analyst_user.uid,
            action="ASSESSMENT_REVIEW_COMPLETED",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={"business_name": assessment.business.name, "decision": "approved"},
            commit=False
        )
    elif new_status == "rejected":
        log_audit_event(
            db=db,
            user_id=analyst_user.uid,
            action="ASSESSMENT_REJECTED",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={"business_name": assessment.business.name, "decision": "rejected"},
            commit=False
        )
        log_audit_event(
            db=db,
            user_id=analyst_user.uid,
            action="ASSESSMENT_REVIEW_COMPLETED",
            resource_type="assessment",
            resource_id=str(assessment.id),
            details={"business_name": assessment.business.name, "decision": "rejected"},
            commit=False
        )

    db.commit()
    db.refresh(assessment)

    pred = assessment.prediction
    bus = assessment.business

    default_probability = pred.default_probability if pred else 0.0
    risk_level = pred.risk_level if pred else "PENDING"
    confidence = pred.confidence if pred else 0.0

    return AssessmentResponse(
        id=assessment.id,
        business_name=bus.name,
        industry=bus.industry,
        annual_revenue=assessment.annual_revenue,
        created_at=assessment.created_at,
        default_probability=default_probability,
        risk_level=risk_level,
        confidence=confidence,
        review_status=assessment.review_status,
        review_notes=assessment.review_notes,
        additional_comments=getattr(assessment, "additional_comments", None),
        reviewed_by=assessment.reviewed_by,
        reviewed_at=assessment.reviewed_at
    )

@router.get("/{id}")
def get_assessment_details(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(models.Assessment).filter(models.Assessment.id == id).first()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
        
    user_role = (current_user.role or "user").lower()
    # Analysts and admins can view any assessment in review workflow; MSME users can only view their own
    if user_role not in ["analyst", "admin"] and assessment.business.user_id != current_user.uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this assessment"
        )
        
    pred = assessment.prediction
    bus = assessment.business

    # Fetch previous assessments for the same business
    history_records = (
        db.query(models.Assessment)
        .filter(models.Assessment.business_id == assessment.business_id, models.Assessment.id != assessment.id)
        .order_by(models.Assessment.created_at.desc())
        .limit(5)
        .all()
    )
    history = [
        {
            "id": h.id,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "default_probability": h.prediction.default_probability if h.prediction else None,
            "risk_level": h.prediction.risk_level if h.prediction else None,
            "confidence": h.prediction.confidence if h.prediction else None,
            "review_status": h.review_status,
            "annual_revenue": h.annual_revenue
        }
        for h in history_records
    ]
    
    return {
        "id": assessment.id,
        "created_at": assessment.created_at,
        "review_status": assessment.review_status or "pending",
        "review_notes": assessment.review_notes,
        "additional_comments": getattr(assessment, "additional_comments", None),
        "reviewed_by": assessment.reviewed_by,
        "reviewed_at": assessment.reviewed_at,
        "business": {
            "id": bus.id,
            "name": bus.name,
            "industry": bus.industry,
            "location": bus.location,
            "description": bus.description,
            "age": bus.age,
            "employees": bus.employees
        },
        "financials": {
            "annual_revenue": assessment.annual_revenue,
            "monthly_cash_flow": assessment.monthly_cash_flow,
            "monthly_expenses": assessment.monthly_expenses,
            "existing_debt": assessment.existing_debt
        },
        "alternative_indicators": {
            "digital_transactions": assessment.digital_transactions,
            "utility_payment_score": assessment.utility_payment_score,
            "invoice_payment_score": assessment.invoice_payment_score,
            "previous_defaults": assessment.previous_defaults
        },
        "prediction": {
            "default_probability": pred.default_probability if pred else 0.0,
            "risk_level": pred.risk_level if pred else "UNKNOWN",
            "confidence": pred.confidence if pred else 0.0,
            "top_factors": pred.top_factors if pred else [],
            "positive_factors": getattr(pred, "positive_factors", []) if pred else [],
            "risk_factors": getattr(pred, "risk_factors", []) if pred else [],
            "model_version": getattr(pred, "model_version", "1.1.0") if pred else "1.1.0"
        },
        "report": assessment.report.report_data if assessment.report else None,
        "history": history
    }
