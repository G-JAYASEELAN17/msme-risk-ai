from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.notifications import (
    NotificationResponse,
    AlertRuleCreate,
    AlertRuleResponse
)
from ..services.audit_service import log_audit_event

router = APIRouter()

# ----------------- NOTIFICATIONS -----------------

@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns notifications for the current authenticated user.
    """
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.uid
    ).order_by(models.Notification.created_at.desc()).limit(30).all()

    return notifs

@router.put("/{id}/read", response_model=NotificationResponse)
def mark_notification_read(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks a single notification as read.
    """
    notif = db.query(models.Notification).filter(
        models.Notification.id == id,
        models.Notification.user_id == current_user.uid
    ).first()

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found."
        )

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif

@router.put("/read-all")
def mark_all_notifications_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks all notifications for current user as read.
    """
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.uid,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a notification.
    """
    notif = db.query(models.Notification).filter(
        models.Notification.id == id,
        models.Notification.user_id == current_user.uid
    ).first()

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found."
        )

    db.delete(notif)
    db.commit()
    return None

# ----------------- ALERT RULES -----------------

@router.get("/alerts/rules", response_model=List[AlertRuleResponse])
def list_alert_rules(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns user-configured risk alert rules.
    """
    rules = db.query(models.AlertRule).filter(
        models.AlertRule.user_id == current_user.uid
    ).order_by(models.AlertRule.created_at.desc()).all()
    return rules

@router.post("/alerts/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
def create_alert_rule(
    payload: AlertRuleCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new risk alert rule.
    """
    rule = models.AlertRule(
        user_id=current_user.uid,
        name=payload.name.strip(),
        rule_type=payload.rule_type,
        threshold=payload.threshold,
        is_active=payload.is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="CREATE_ALERT_RULE",
        resource_type="alert_rule",
        resource_id=str(rule.id),
        details={"name": rule.name, "threshold": rule.threshold}
    )

    return rule

@router.delete("/alerts/rules/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert_rule(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes an alert rule.
    """
    rule = db.query(models.AlertRule).filter(
        models.AlertRule.id == id,
        models.AlertRule.user_id == current_user.uid
    ).first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found."
        )

    db.delete(rule)
    db.commit()
    return None
