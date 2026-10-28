import pytest
from unittest.mock import patch, MagicMock
from app.database import models

# Helper headers
ADMIN_HEADERS = {"Authorization": "Bearer test_token:admin_root_1:admin@msmerisk.ai:System Administrator"}
USER_HEADERS = {"Authorization": "Bearer test_token:user_msme_1:borrower@msme.com:MSME Owner"}
ANALYST_HEADERS = {"Authorization": "Bearer test_token:analyst_applicant_1:analyst@bank.com:Analyst Priya"}

def test_check_email_availability(client, db_session):
    # Check fresh email
    res = client.post("/api/users/check-email", json={"email": "unique_borrower@enterprise.com"})
    assert res.status_code == 200
    assert res.json()["exists"] is False

    # Insert existing user
    user = models.User(
        uid="existing_uid_101",
        email="existing_borrower@enterprise.com",
        name="Existing Borrower",
        role="user",
        approval_status="active"
    )
    db_session.add(user)
    db_session.commit()

    # Check again -> should exist
    res2 = client.post("/api/users/check-email", json={"email": "existing_borrower@enterprise.com"})
    assert res2.status_code == 200
    assert res2.json()["exists"] is True
    assert "already exists" in res2.json()["message"]

def test_msme_user_registration_success(client, db_session):
    mock_fb_user = MagicMock()
    mock_fb_user.uid = "new_fb_msme_1"

    with patch("firebase_admin.auth.create_user", return_value=mock_fb_user):
        payload = {
            "email": "fresh_msme@biz.com",
            "password": "Password123!",
            "name": "Jane Owner",
            "phone": "+1234567890",
            "business_name": "Jane Logistics LLC",
            "industry": "Logistics & Supply Chain",
            "business_age": 4,
            "employees": 15
        }
        res = client.post("/api/users/register", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["role"] == "user"
        assert data["approval_status"] == "active"
        assert data["requires_email_verification"] is True

        # Check DB persistence
        db_user = db_session.query(models.User).filter(models.User.email == "fresh_msme@biz.com").first()
        assert db_user is not None
        assert db_user.role == "user"
        assert db_user.approval_status == "active"

        # Check Business persistence
        biz = db_session.query(models.Business).filter(models.Business.name == "Jane Logistics LLC").first()
        assert biz is not None
        assert biz.user_id == db_user.uid

def test_analyst_registration_submits_pending_approval(client, db_session):
    mock_fb_user = MagicMock()
    mock_fb_user.uid = "new_fb_analyst_1"

    with patch("firebase_admin.auth.create_user", return_value=mock_fb_user):
        payload = {
            "email": "applicant@ratingagency.com",
            "password": "SecurePassword123!",
            "name": "Alex Underwriter",
            "organization": "Global Rating Corp",
            "qualifications": "CFA, FRM",
            "experience_years": "6-10 years",
            "application_reason": "Evaluating small commercial loans and credit lines"
        }
        res = client.post("/api/users/register", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["role"] == "analyst"
        assert data["approval_status"] == "pending_email_verification"

        # Check DB
        db_user = db_session.query(models.User).filter(models.User.email == "applicant@ratingagency.com").first()
        assert db_user is not None
        assert db_user.role == "analyst"
        assert db_user.approval_status == "pending_email_verification"
        assert db_user.qualifications == "CFA, FRM"

def test_duplicate_email_registration_rejected(client, db_session):
    user = models.User(
        uid="preexisting_user_99",
        email="duplicate@msme.com",
        name="Pre-existing User",
        role="user",
        approval_status="active"
    )
    db_session.add(user)
    db_session.commit()

    payload = {
        "email": "duplicate@msme.com",
        "password": "Password123!",
        "name": "Duplicate Attempt",
        "business_name": "Duplicate Co",
        "industry": "Retail"
    }
    res = client.post("/api/users/register", json=payload)
    assert res.status_code == 409
    assert "An account with this email already exists" in res.json()["detail"]

def test_cannot_self_assign_admin_role_during_registration(client):
    payload = {
        "email": "hacker@evil.com",
        "password": "Password123!",
        "name": "Hacker",
        "role": "admin",
        "business_name": "Evil Corp",
        "industry": "Tech"
    }
    res = client.post("/api/users/register", json=payload)
    # Backend ignores or strictly creates 'user' or 'analyst', never 'admin'
    if res.status_code == 200:
        assert res.json()["role"] != "admin"

def test_analyst_approval_state_machine_and_repeated_logins(client, db_session):
    # 1. Setup Admin user
    admin = models.User(
        uid="admin_root_1",
        email="admin@msmerisk.ai",
        name="System Administrator",
        role="admin",
        approval_status="active"
    )
    db_session.add(admin)

    # 2. Setup Analyst applicant with pending_admin_approval
    analyst = models.User(
        uid="analyst_applicant_1",
        email="analyst@bank.com",
        name="Analyst Priya",
        role="analyst",
        approval_status="pending_admin_approval",
        qualifications="CA, MBA",
        experience_years="3-5 years",
        application_reason="Credit underwriting"
    )
    db_session.add(analyst)
    db_session.commit()

    # 3. Analyst tries to access protected analyst assessments -> 403 Forbidden
    res_denied = client.get("/api/assessments/analyst/dashboard", headers=ANALYST_HEADERS)
    assert res_denied.status_code == 403
    assert "Your analyst application is awaiting administrator approval" in res_denied.json()["detail"]

    # 4. Non-admin (ordinary user) tries to approve analyst -> 403 Forbidden
    user_regular = models.User(
        uid="user_msme_1",
        email="borrower@msme.com",
        name="MSME Owner",
        role="user",
        approval_status="active"
    )
    db_session.add(user_regular)
    db_session.commit()

    res_hack = client.put(f"/api/users/admin/analyst-requests/{analyst.uid}/approve", headers=USER_HEADERS)
    assert res_hack.status_code == 403

    # 5. Analyst cannot self-approve -> 403 Forbidden
    res_self = client.put(f"/api/users/admin/analyst-requests/{analyst.uid}/approve", headers=ANALYST_HEADERS)
    assert res_self.status_code == 403

    # 6. Admin approves analyst
    with patch("firebase_admin.auth.set_custom_user_claims"):
        res_approve = client.put(f"/api/users/admin/analyst-requests/{analyst.uid}/approve", headers=ADMIN_HEADERS)
        assert res_approve.status_code == 200
        assert res_approve.json()["approval_status"] == "approved"

    # Refresh DB session
    db_session.refresh(analyst)
    assert analyst.approval_status == "approved"
    assert analyst.approved_by == admin.uid

    # 7. Analyst accesses protected endpoint repeatedly -> 200 OK without re-approval!
    res_ok_1 = client.get("/api/assessments/analyst/dashboard", headers=ANALYST_HEADERS)
    assert res_ok_1.status_code == 200

    res_ok_2 = client.get("/api/assessments/analyst/dashboard", headers=ANALYST_HEADERS)
    assert res_ok_2.status_code == 200

    # 8. Admin suspends analyst -> access denied
    res_suspend = client.put(f"/api/users/admin/analyst-requests/{analyst.uid}/suspend", headers=ADMIN_HEADERS)
    assert res_suspend.status_code == 200
    assert res_suspend.json()["approval_status"] == "suspended"

    res_suspended = client.get("/api/assessments/analyst/dashboard", headers=ANALYST_HEADERS)
    assert res_suspended.status_code == 403
    assert "Your account is currently unavailable" in res_suspended.json()["detail"]

    # 9. Admin reactivates analyst -> access restored
    res_reactivate = client.put(f"/api/users/admin/analyst-requests/{analyst.uid}/reactivate", headers=ADMIN_HEADERS)
    assert res_reactivate.status_code == 200
    assert res_reactivate.json()["approval_status"] == "approved"

    res_ok_3 = client.get("/api/assessments/analyst/dashboard", headers=ANALYST_HEADERS)
    assert res_ok_3.status_code == 200

def test_rejection_requires_reason(client, db_session):
    admin = models.User(
        uid="admin_root_1",
        email="admin@msmerisk.ai",
        name="System Administrator",
        role="admin",
        approval_status="active"
    )
    db_session.add(admin)

    target_analyst = models.User(
        uid="analyst_rejected_candidate",
        email="candidate@unverified.org",
        name="Unqualified Candidate",
        role="analyst",
        approval_status="pending_admin_approval"
    )
    db_session.add(target_analyst)
    db_session.commit()

    # Reject without reason -> 422 Unprocessable Entity
    res_no_reason = client.put(
        f"/api/users/admin/analyst-requests/{target_analyst.uid}/reject",
        json={"reason": ""},
        headers=ADMIN_HEADERS
    )
    assert res_no_reason.status_code in [400, 422]

    # Reject with reason -> 200 OK
    res_rejected = client.put(
        f"/api/users/admin/analyst-requests/{target_analyst.uid}/reject",
        json={"reason": "Insufficient verifiable institutional credit experience"},
        headers=ADMIN_HEADERS
    )
    assert res_rejected.status_code == 200
    assert res_rejected.json()["approval_status"] == "rejected"
    assert res_rejected.json()["rejection_reason"] == "Insufficient verifiable institutional credit experience"

    # Access by rejected analyst is 403
    rejected_headers = {"Authorization": "Bearer test_token:analyst_rejected_candidate:candidate@unverified.org:Unqualified Candidate"}
    res_denied = client.get("/api/assessments/analyst/dashboard", headers=rejected_headers)
    assert res_denied.status_code == 403
    assert "Your analyst application was not approved" in res_denied.json()["detail"]
