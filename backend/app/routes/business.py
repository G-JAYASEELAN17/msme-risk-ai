from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.business import BusinessCreate, BusinessUpdate, BusinessResponse, BusinessAssessmentItem
from ..services.audit_service import log_audit_event

router = APIRouter()

@router.get("", response_model=List[BusinessResponse])
def get_businesses(
    all_users: Optional[bool] = Query(False, description="Admin/Analyst only: View all platform businesses"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all businesses owned by current authenticated user, or all portfolio businesses if requested by an Analyst or Admin.
    """
    user_role = (current_user.role or "user").lower()
    query = db.query(models.Business)
    if not (all_users and user_role in ["admin", "analyst"]):
        query = query.filter(models.Business.user_id == current_user.uid)
    businesses = query.order_by(models.Business.created_at.desc()).all()

    responses = []
    for b in businesses:
        assessments = db.query(models.Assessment).filter(
            models.Assessment.business_id == b.id
        ).order_by(models.Assessment.created_at.desc()).all()

        total = len(assessments)
        latest_risk = None
        latest_prob = None

        if total > 0 and assessments[0].prediction:
            latest_risk = assessments[0].prediction.risk_level
            latest_default_probability = assessments[0].prediction.default_probability
        else:
            latest_default_probability = None

        responses.append(BusinessResponse(
            id=b.id,
            name=b.name,
            industry=b.industry,
            location=b.location,
            description=b.description,
            age=b.age,
            employees=b.employees,
            created_at=b.created_at,
            updated_at=b.updated_at,
            total_assessments=total,
            latest_risk_level=latest_risk,
            latest_default_probability=latest_default_probability
        ))

    return responses

@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new business profile owned by the authenticated user.
    """
    business = models.Business(
        user_id=current_user.uid,
        name=payload.name.strip(),
        industry=payload.industry.strip(),
        location=payload.location,
        description=payload.description,
        age=payload.age,
        employees=payload.employees
    )
    db.add(business)
    db.commit()
    db.refresh(business)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="CREATE_BUSINESS",
        resource_type="business",
        resource_id=str(business.id),
        details={"name": business.name, "industry": business.industry}
    )

    return BusinessResponse(
        id=business.id,
        name=business.name,
        industry=business.industry,
        location=business.location,
        description=business.description,
        age=business.age,
        employees=business.employees,
        created_at=business.created_at,
        updated_at=business.updated_at,
        total_assessments=0
    )

@router.get("/{id}", response_model=BusinessResponse)
def get_business_details(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves a business profile with its full assessment history timeline.
    """
    user_role = (current_user.role or "user").lower()
    query = db.query(models.Business).filter(models.Business.id == id)
    if user_role not in ["admin", "analyst"]:
        query = query.filter(models.Business.user_id == current_user.uid)
    business = query.first()

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found or unauthorized."
        )

    assessments = db.query(models.Assessment).filter(
        models.Assessment.business_id == business.id
    ).order_by(models.Assessment.created_at.desc()).all()

    assessment_items = []
    for a in assessments:
        if a.prediction:
            assessment_items.append(BusinessAssessmentItem(
                id=a.id,
                created_at=a.created_at,
                annual_revenue=a.annual_revenue,
                monthly_cash_flow=a.monthly_cash_flow,
                existing_debt=a.existing_debt,
                default_probability=a.prediction.default_probability,
                risk_level=a.prediction.risk_level,
                confidence=a.prediction.confidence
            ))

    total = len(assessments)
    latest_risk = assessment_items[0].risk_level if assessment_items else None
    latest_prob = assessment_items[0].default_probability if assessment_items else None

    return BusinessResponse(
        id=business.id,
        name=business.name,
        industry=business.industry,
        location=business.location,
        description=business.description,
        age=business.age,
        employees=business.employees,
        created_at=business.created_at,
        updated_at=business.updated_at,
        total_assessments=total,
        latest_risk_level=latest_risk,
        latest_default_probability=latest_prob,
        assessments=assessment_items
    )

@router.put("/{id}", response_model=BusinessResponse)
def update_business(
    id: int,
    payload: BusinessUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates business profile details.
    """
    business = db.query(models.Business).filter(
        models.Business.id == id,
        models.Business.user_id == current_user.uid
    ).first()

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found or unauthorized."
        )

    if payload.name is not None:
        business.name = payload.name.strip()
    if payload.industry is not None:
        business.industry = payload.industry.strip()
    if payload.location is not None:
        business.location = payload.location.strip()
    if payload.description is not None:
        business.description = payload.description.strip()
    if payload.age is not None:
        business.age = payload.age
    if payload.employees is not None:
        business.employees = payload.employees

    db.commit()
    db.refresh(business)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="UPDATE_BUSINESS",
        resource_type="business",
        resource_id=str(business.id),
        details={"name": business.name}
    )

    return BusinessResponse(
        id=business.id,
        name=business.name,
        industry=business.industry,
        location=business.location,
        description=business.description,
        age=business.age,
        employees=business.employees,
        created_at=business.created_at,
        updated_at=business.updated_at
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a business and all associated assessments.
    """
    business = db.query(models.Business).filter(
        models.Business.id == id,
        models.Business.user_id == current_user.uid
    ).first()

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found or unauthorized."
        )

    bus_name = business.name
    db.delete(business)
    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="DELETE_BUSINESS",
        resource_type="business",
        resource_id=str(id),
        details={"name": bus_name}
    )

    return None
