import os
import sys
import requests

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

BASE_URL = "http://127.0.0.1:8000"

def test_live_workflow():
    print(f"=== Testing Live MSME Risk AI Workflow against {BASE_URL} ===")
    
    # 1. Health Check
    health_resp = requests.get(f"{BASE_URL}/api/health", timeout=30)
    print("Health Status Code:", health_resp.status_code)
    health_data = health_resp.json()
    print("Health Data:", health_data)
    assert health_resp.status_code == 200
    assert health_data["database_type"] == "postgresql"
    assert health_data["status"] == "healthy"

    # Define headers
    user_headers = {"Authorization": "Bearer test_token:live_borrower_1:live_borrower_1@workflow.msme.com:Live Borrower"}
    analyst_headers = {"Authorization": "Bearer test_token:live_analyst_1:live_analyst_1@workflow.msme.com:Senior Credit Analyst"}
    admin_headers = {"Authorization": "Bearer test_token:live_admin_1:live_admin_1@workflow.msme.com:Chief Risk Officer"}

    # Explicitly seed/update users in Supabase PostgreSQL with their roles
    from app.database.database import SessionLocal
    from app.database import models
    db = SessionLocal()
    try:
        for uid, email, name, role in [
            ("live_borrower_1", "live_borrower_1@workflow.msme.com", "Live Borrower", "user"),
            ("live_analyst_1", "live_analyst_1@workflow.msme.com", "Senior Credit Analyst", "analyst"),
            ("live_admin_1", "live_admin_1@workflow.msme.com", "Chief Risk Officer", "admin"),
        ]:
            u = db.query(models.User).filter(models.User.uid == uid).first()
            if not u:
                u = models.User(uid=uid, email=email, name=name, role=role)
                db.add(u)
            else:
                u.role = role
                u.email = email
                u.name = name
        db.commit()
        print("Explicitly seeded and verified roles in Supabase: borrower=user, analyst=analyst, admin=admin")
    finally:
        db.close()

    # 2. RBAC Verification: Normal user denied analyst dashboard
    user_dash_resp = requests.get(f"{BASE_URL}/api/assessments/analyst/dashboard", headers=user_headers)
    print("User Dashboard Access (expected 403):", user_dash_resp.status_code)
    assert user_dash_resp.status_code == 403

    # 3. Analyst Dashboard Access
    analyst_dash_resp = requests.get(f"{BASE_URL}/api/assessments/analyst/dashboard", headers=analyst_headers)
    print("Analyst Dashboard Access (expected 200):", analyst_dash_resp.status_code)
    assert analyst_dash_resp.status_code == 200
    dash_stats = analyst_dash_resp.json()
    print("Analyst Queue Metrics:", dash_stats)
    for key in [
        "total_assessments", "pending_reviews", "in_review_assessments",
        "completed_reviews", "low_risk_assessments", "medium_risk_assessments", "high_risk_assessments"
    ]:
        assert key in dash_stats

    # 4. Admin Access to Analyst Dashboard
    admin_dash_resp = requests.get(f"{BASE_URL}/api/assessments/analyst/dashboard", headers=admin_headers)
    assert admin_dash_resp.status_code == 200
    print("Admin Analyst Dashboard Access (expected 200): 200 OK")

    # 5. Create a business & assessment for live_borrower_1
    bus_resp = requests.post(f"{BASE_URL}/api/businesses", headers=user_headers, json={
        "name": "Live Solar Innovations Ltd",
        "industry": "CleanTech",
        "registration_number": "REG-2026-LIVE-01",
        "age": 4,
        "employees": 18
    })
    print("Create Business Status:", bus_resp.status_code)
    bus_data = bus_resp.json()
    bus_id = bus_data["id"]

    # Predict / Create assessment
    predict_payload = {
        "name": "Live Solar Innovations Ltd",
        "industry": "CleanTech",
        "age": 4,
        "employees": 18,
        "annual_revenue": 950000.0,
        "monthly_cash_flow": 72000.0,
        "monthly_expenses": 50000.0,
        "existing_debt": 140000.0,
        "digital_transactions": 280,
        "utility_payment_score": 88.0,
        "invoice_payment_score": 85.0,
        "previous_defaults": 0
    }
    predict_resp = requests.post(f"{BASE_URL}/api/predict", headers=user_headers, json=predict_payload)
    print("Predict Assessment Status:", predict_resp.status_code)
    assert predict_resp.status_code == 200
    pred_data = predict_resp.json()
    ass_id = pred_data.get("assessment_id")
    print(f"Created Assessment ID: {ass_id}, Risk Level: {pred_data.get('risk_level')}, Probability: {pred_data.get('default_probability')}%")

    # 6. User denied review action
    user_review_resp = requests.put(f"{BASE_URL}/api/assessments/{ass_id}/review", headers=user_headers, json={
        "review_status": "in_review",
        "review_notes": "Unauthorized self review"
    })
    print("User Attempt Review (expected 403):", user_review_resp.status_code)
    assert user_review_resp.status_code == 403

    # 7. Analyst Action 1: Start Review
    start_resp = requests.put(f"{BASE_URL}/api/assessments/{ass_id}/review", headers=analyst_headers, json={
        "review_status": "in_review",
        "review_notes": "Credit analyst assigned. Initiating underwriting verification."
    })
    print("Analyst Start Review Status:", start_resp.status_code)
    assert start_resp.status_code == 200
    assert start_resp.json()["review_status"] == "in_review"

    # 8. Analyst Action 2: Request More Information
    info_resp = requests.put(f"{BASE_URL}/api/assessments/{ass_id}/review", headers=analyst_headers, json={
        "review_status": "needs_info",
        "review_notes": "Please upload Q4 audited utility bills and supplier contracts.",
        "additional_comments": "Urgent verification required for high-volume transactions."
    })
    print("Analyst Request Info Status:", info_resp.status_code)
    assert info_resp.status_code == 200
    assert info_resp.json()["review_status"] == "needs_info"
    assert info_resp.json()["additional_comments"] == "Urgent verification required for high-volume transactions."

    # 9. Analyst Action 3: Complete Review (Approve)
    approve_resp = requests.put(f"{BASE_URL}/api/assessments/{ass_id}/review", headers=analyst_headers, json={
        "review_status": "approved",
        "review_notes": "All documentation verified. Solid debt service coverage ratio.",
        "additional_comments": "Approved for $150,000 at prime + 1.5%."
    })
    print("Analyst Approve Assessment Status:", approve_resp.status_code)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["review_status"] == "approved"

    # 10. Verify GET /api/assessments/{id} contains complete review data & history
    detail_resp = requests.get(f"{BASE_URL}/api/assessments/{ass_id}", headers=analyst_headers)
    print("Assessment Details Status:", detail_resp.status_code)
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert detail_data["review_status"] == "approved"
    assert detail_data["additional_comments"] == "Approved for $150,000 at prime + 1.5%."
    assert "business" in detail_data
    assert "financials" in detail_data
    assert "prediction" in detail_data
    assert "history" in detail_data
    print("Assessment Details Payload Verified: Contains business, financials, prediction, history, comments")

    # 11. Verify Database Notifications and Audit Logs in Supabase PostgreSQL
    db = SessionLocal()
    try:
        # Check borrower notification
        notifs = db.query(models.Notification).filter(
            models.Notification.user_id == "live_borrower_1",
            models.Notification.related_assessment_id == ass_id
        ).all()
        print(f"Verified {len(notifs)} Notifications created for borrower in Supabase PostgreSQL:")
        for n in notifs:
            print(f"  - [{n.type}] {n.title}: {n.message}")
        assert len(notifs) >= 2

        # Check audit logs
        audit_logs = db.query(models.AuditLog).filter(
            models.AuditLog.resource_id == str(ass_id)
        ).all()
        print(f"Verified {len(audit_logs)} Audit Logs created in Supabase PostgreSQL:")
        actions = [log.action for log in audit_logs]
        for a in actions:
            print(f"  - Action: {a}")
        assert "ASSESSMENT_REVIEW_STARTED" in actions
        assert "ASSESSMENT_INFO_REQUESTED" in actions
        assert "ASSESSMENT_APPROVED" in actions
        assert "ASSESSMENT_REVIEW_COMPLETED" in actions

    finally:
        db.close()

    print("\n>>> ALL LIVE WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_live_workflow()
