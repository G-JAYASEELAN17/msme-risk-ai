import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from ..database import models

logger = logging.getLogger(__name__)

def log_audit_event(
    db: Session,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    commit: bool = True
):
    """
    Safely creates an audit log entry.
    Never stores sensitive credentials or private tokens.
    """
    try:
        clean_details = details or {}
        # Strip out any potential token/secret keys
        sanitized = {k: v for k, v in clean_details.items() if "token" not in k.lower() and "password" not in k.lower()}
        
        log = models.AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            details=sanitized
        )
        db.add(log)
        if commit:
            db.commit()
    except Exception as e:
        logger.error(f"Failed to record audit event: {e}")
        if commit:
            db.rollback()

def create_notification_if_alert(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    notif_type: str = "info",
    link: Optional[str] = None,
    commit: bool = True
):
    """
    Generates a notification record for user.
    """
    try:
        notif = models.Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notif_type,
            link=link
        )
        db.add(notif)
        if commit:
            db.commit()
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        if commit:
            db.rollback()
