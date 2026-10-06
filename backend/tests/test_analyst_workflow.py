import pytest
from fastapi.testclient import TestClient
from app.database import models

def test_analyst_dashboard_access_and_rbac(client: TestClient, auth_headers_user1: dict, auth_headers_user2: dict, db_session):
    # Setup User 1 as 'user' role
    user1 = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user1:
        user1 = models.User(uid="user_alpha_1", email="alpha@msme.com", role="user")
        db_session.add(user1)
    else:
        user1.role = "user"

    # Setup User 2 as 'analyst' role
    user2 = db_session.query(models.User).filter(models.User.uid == "user_beta_2").first()
    if not user2:
        user2 = models.User(uid="user_beta_2", email="analyst@msme.com", role="analyst")
        db_session.add(user2)
    else:
        user2.role = "analyst"
    
    # Setup Admin user
    admin_user = db_session.query(models.User).filter(models.User.uid == "user_admin_9").first()
    if not admin_user:
        admin_user = models.User(uid="user_admin_9", email="admin@msme.com", role="admin")
        db_session.add(admin_user)
    else:
        admin_user.role = "admin"
    db_session.commit()

    admin_headers = {"Authorization": "Bearer test_token:user_admin_9:admin@msme.com:Administrator"}

    # 1. User denied analyst dashboard access -> 403 Forbidden
    resp_user = client.get("/api/assessments/analyst/dashboard", headers=auth_headers_user1)
    assert resp_user.status_code == 403
    assert "Access denied" in resp_user.json()["detail"]

    # 2. Analyst can access dashboard -> 200 OK with 7 metrics
    resp_analyst = client.get("/api/assessments/analyst/dashboard", headers=auth_headers_user2)
    assert resp_analyst.status_code == 200
    stats = resp_analyst.json()
    assert "total_assessments" in stats
    assert "pending_reviews" in stats
    assert "in_review_assessments" in stats
    assert "completed_reviews" in stats
    assert "low_risk_assessments" in stats
    assert "medium_risk_assessments" in stats
    assert "high_risk_assessments" in stats

    # 3. Admin can access analyst dashboard -> 200 OK
    resp_admin = client.get("/api/assessments/analyst/dashboard", headers=admin_headers)
    assert resp_admin.status_code == 200


def test_complete_analyst_review_workflow(client: TestClient, auth_headers_user1: dict, auth_headers_user2: dict, db_session):
    # Setup Borrower (user) and Analyst (analyst)
    user1 = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user1:
        user1 = models.User(uid="user_alpha_1", email="borrower@msme.com", role="user")
        db_session.add(user1)
    else:
        user1.role = "user"

    user2 = db_session.query(models.User).filter(models.User.uid == "user_beta_2").first()
    if not user2:
        user2 = models.User(uid="user_beta_2", email="analyst@msme.com", role="analyst")
        db_session.add(user2)
    else:
        user2.role = "analyst"
    db_session.commit()

    # Create business and two assessments (to test history)
    bus = models.Business(
        user_id="user_alpha_1",
        name="Apex Manufacturing",
        industry="Manufacturing",
        age=6,
        employees=25
    )
    db_session.add(bus)
    db_session.commit()
    db_session.refresh(bus)

    # Past assessment
    ass_past = models.Assessment(
        business_id=bus.id,
        annual_revenue=800000.0,
        monthly_cash_flow=60000.0,
        monthly_expenses=45000.0,
        existing_debt=120000.0,
        digital_transactions=150,
        utility_payment_score=75.0,
        invoice_payment_score=80.0,
        previous_defaults=0,
        review_status="approved",
        review_notes="Initial approval in 2025"
    )
    db_session.add(ass_past)
    db_session.commit()

    # Current assessment under evaluation
    ass = models.Assessment(
        business_id=bus.id,
        annual_revenue=1200000.0,
        monthly_cash_flow=95000.0,
        monthly_expenses=65000.0,
        existing_debt=180000.0,
        digital_transactions=350,
        utility_payment_score=92.0,
        invoice_payment_score=88.0,
        previous_defaults=0,
        review_status="pending"
    )
    db_session.add(ass)
    db_session.commit()
    db_session.refresh(ass)

    # ML Prediction
    pred = models.Prediction(
        assessment_id=ass.id,
        default_probability=18.5,
        risk_level="LOW",
        confidence=91.0,
        top_factors=["Strong Cash Flow", "High Utility Payment Score"],
        model_version="1.0"
    )
    db_session.add(pred)
    db_session.commit()

    # 1. Normal user cannot perform review action -> 403 Forbidden
    resp_user_review = client.put(
        f"/api/assessments/{ass.id}/review",
        json={"review_status": "in_review", "review_notes": "Attempting unauthorized action"},
        headers=auth_headers_user1
    )
    assert resp_user_review.status_code == 403

    # 2. Detailed Assessment Review Page API: GET /api/assessments/{id}
    resp_detail = client.get(f"/api/assessments/{ass.id}", headers=auth_headers_user2)
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert detail["id"] == ass.id
    assert detail["business"]["name"] == "Apex Manufacturing"
    assert detail["financials"]["annual_revenue"] == 1200000.0
    assert detail["alternative_indicators"]["digital_transactions"] == 350
    assert detail["prediction"]["risk_level"] == "LOW"
    assert "history" in detail
    assert len(detail["history"]) >= 1
    assert detail["history"][0]["id"] == ass_past.id

    # 3. Action: Start Review (status: "in_review")
    resp_start = client.put(
        f"/api/assessments/{ass.id}/review",
        json={"review_status": "in_review", "review_notes": "Starting underwriting review."},
        headers=auth_headers_user2
    )
    assert resp_start.status_code == 200
    data_start = resp_start.json()
    assert data_start["review_status"] == "in_review"
    assert data_start["reviewed_by"] == "user_beta_2"

    # Audit log check: ASSESSMENT_REVIEW_STARTED
    audit_start = db_session.query(models.AuditLog).filter(
        models.AuditLog.action == "ASSESSMENT_REVIEW_STARTED",
        models.AuditLog.resource_id == str(ass.id)
    ).first()
    assert audit_start is not None
    assert audit_start.user_id == "user_beta_2"

    # 4. Action: Request More Information (status: "needs_info")
    resp_info = client.put(
        f"/api/assessments/{ass.id}/review",
        json={
            "review_status": "needs_info",
            "review_notes": "Please provide latest GST returns.",
            "additional_comments": "Specifically Q3 and Q4 filings."
        },
        headers=auth_headers_user2
    )
    assert resp_info.status_code == 200
    data_info = resp_info.json()
    assert data_info["review_status"] == "needs_info"
    assert data_info["additional_comments"] == "Specifically Q3 and Q4 filings."

    # Audit log check: ASSESSMENT_INFO_REQUESTED
    audit_info = db_session.query(models.AuditLog).filter(
        models.AuditLog.action == "ASSESSMENT_INFO_REQUESTED",
        models.AuditLog.resource_id == str(ass.id)
    ).first()
    assert audit_info is not None

    # Notification check for borrower
    notif_info = db_session.query(models.Notification).filter(
        models.Notification.user_id == "user_alpha_1"
    ).order_by(models.Notification.id.desc()).first()
    assert notif_info is not None
    assert "Additional information has been requested for your assessment" in notif_info.message

    # 5. Action: Complete Review - Approve assessment (status: "approved")
    resp_approve = client.put(
        f"/api/assessments/{ass.id}/review",
        json={
            "review_status": "approved",
            "review_notes": "GST filings confirmed. Strong liquidity and solid profit margin.",
            "additional_comments": "Credit limit recommended: $250,000."
        },
        headers=auth_headers_user2
    )
    assert resp_approve.status_code == 200
    data_approve = resp_approve.json()
    assert data_approve["review_status"] == "approved"
    assert data_approve["additional_comments"] == "Credit limit recommended: $250,000."

    # Database persistence verification
    db_session.expire_all()
    ass_db = db_session.query(models.Assessment).filter(models.Assessment.id == ass.id).first()
    assert ass_db.review_status == "approved"
    assert ass_db.reviewed_by == "user_beta_2"
    assert ass_db.review_notes == "GST filings confirmed. Strong liquidity and solid profit margin."
    assert ass_db.additional_comments == "Credit limit recommended: $250,000."
    assert ass_db.reviewed_at is not None

    # Audit log checks: ASSESSMENT_APPROVED and ASSESSMENT_REVIEW_COMPLETED
    audit_app = db_session.query(models.AuditLog).filter(
        models.AuditLog.action == "ASSESSMENT_APPROVED",
        models.AuditLog.resource_id == str(ass.id)
    ).first()
    assert audit_app is not None

    audit_comp = db_session.query(models.AuditLog).filter(
        models.AuditLog.action == "ASSESSMENT_REVIEW_COMPLETED",
        models.AuditLog.resource_id == str(ass.id)
    ).first()
    assert audit_comp is not None

    # Notification check for approval
    notif_app = db_session.query(models.Notification).filter(
        models.Notification.user_id == "user_alpha_1"
    ).order_by(models.Notification.created_at.desc()).first()
    assert notif_app is not None
    assert "reviewed" in notif_app.message.lower()

    # 6. Action: Reject assessment (status: "rejected") on a secondary assessment
    ass_reject = models.Assessment(
        business_id=bus.id,
        annual_revenue=100000.0,
        monthly_cash_flow=2000.0,
        monthly_expenses=9000.0,
        existing_debt=200000.0,
        digital_transactions=20,
        utility_payment_score=40.0,
        invoice_payment_score=35.0,
        previous_defaults=2,
        review_status="pending"
    )
    db_session.add(ass_reject)
    db_session.commit()
    db_session.refresh(ass_reject)

    resp_reject = client.put(
        f"/api/assessments/{ass_reject.id}/review",
        json={
            "review_status": "rejected",
            "review_notes": "High debt-to-income ratio, severe negative monthly cash flow.",
            "additional_comments": "Re-apply after 6 months of positive cash flow."
        },
        headers=auth_headers_user2
    )
    assert resp_reject.status_code == 200
    data_rej = resp_reject.json()
    assert data_rej["review_status"] == "rejected"

    # Audit log check: ASSESSMENT_REJECTED
    audit_rej = db_session.query(models.AuditLog).filter(
        models.AuditLog.action == "ASSESSMENT_REJECTED",
        models.AuditLog.resource_id == str(ass_reject.id)
    ).first()
    assert audit_rej is not None
