import pytest
from fastapi.testclient import TestClient
from app.database import models

def test_admin_endpoints_require_admin_role(client: TestClient, auth_headers_user1: dict, db_session):
    # 1. Normal user cannot access admin user list -> Expected 403
    user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user:
        user = models.User(uid="user_alpha_1", email="alpha@msme.com", role="user")
        db_session.add(user)
    else:
        user.role = "user"
    db_session.commit()

    resp = client.get("/api/users/admin/users", headers=auth_headers_user1)
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["detail"]

    # Non-admin requests to /api/users/admin/stats should return 403 Forbidden
    resp = client.get("/api/users/admin/stats", headers=auth_headers_user1)
    assert resp.status_code == 403

    # 2. Normal user cannot change roles -> Expected 403
    resp = client.put("/api/users/admin/users/user_beta_2/role", json={"role": "admin"}, headers=auth_headers_user1)
    assert resp.status_code == 403

def test_analyst_cannot_change_roles(client: TestClient, auth_headers_user2: dict, db_session):
    # 3. Analyst cannot change roles -> Expected 403
    user2 = db_session.query(models.User).filter(models.User.uid == "user_beta_2").first()
    if not user2:
        user2 = models.User(uid="user_beta_2", email="analyst@msme.com", role="analyst")
        db_session.add(user2)
    else:
        user2.role = "analyst"
    db_session.commit()

    resp = client.put("/api/users/admin/users/user_alpha_1/role", json={"role": "admin"}, headers=auth_headers_user2)
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["detail"]

def test_admin_can_manage_roles_and_view_stats(client: TestClient, auth_headers_user1: dict, db_session):
    # Promote user_alpha_1 to 'admin'
    user1 = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user1:
        user1 = models.User(uid="user_alpha_1", email="alpha@msme.com", role="admin")
        db_session.add(user1)
    else:
        user1.role = "admin"
    db_session.commit()

    # Create target user2
    user2 = db_session.query(models.User).filter(models.User.uid == "user_beta_2").first()
    if not user2:
        user2 = models.User(uid="user_beta_2", email="beta@msme.com", role="user")
        db_session.add(user2)
    else:
        user2.role = "user"
    db_session.commit()

    # 4. Admin can list users -> Expected 200
    resp = client.get("/api/users/admin/users", headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(u["uid"] == "user_alpha_1" for u in data)

    # 5. Admin can change another user's role -> Expected 200
    resp = client.put(
        "/api/users/admin/users/user_beta_2/role", 
        json={"role": "analyst"}, 
        headers=auth_headers_user1
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "analyst"

    # Verify audit log was recorded (ROLE_CHANGED and UPDATE_USER_ROLE)
    audit = db_session.query(models.AuditLog).filter(models.AuditLog.action.in_(["ROLE_CHANGED", "UPDATE_USER_ROLE"])).first()
    assert audit is not None
    assert audit.user_id == "user_alpha_1"
    assert audit.resource_id == "user_beta_2"

    # 6. User cannot change own role -> Expected 403
    resp_self = client.put(
        "/api/users/admin/users/user_alpha_1/role",
        json={"role": "user"},
        headers=auth_headers_user1
    )
    assert resp_self.status_code == 403
    assert "Access denied" in resp_self.json()["detail"]

    # Admin views platform stats -> Expected 200
    resp = client.get("/api/users/admin/stats", headers=auth_headers_user1)
    assert resp.status_code == 200
    stats = resp.json()
    assert "total_users" in stats
    assert "total_businesses" in stats
    assert "role_distribution" in stats
    assert "pending_reviews" in stats
    assert "approved_assessments" in stats
