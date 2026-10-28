import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from app.database.diagnostics import categorize_db_error, diagnose_database_connection
from app.database import models


def test_categorize_db_error_tenant_not_found():
    exc = Exception("FATAL: (ENOTFOUND) tenant/user postgres.ryhzhtwknqanwbpvpaes not found")
    res = categorize_db_error(exc)
    assert res["category"] == "TENANT_OR_USER_NOT_FOUND"
    assert "tenant" in res["message"].lower()
    # Ensure no credentials or project ref in sanitized message
    assert "ryhzhtwknqanwbpvpaes" not in res["message"]


def test_categorize_db_error_dns_failure():
    exc = Exception("[Errno 11001] getaddrinfo failed")
    res = categorize_db_error(exc)
    assert res["category"] == "DNS_RESOLUTION_FAILURE"
    assert "dns" in res["message"].lower()


def test_categorize_db_error_auth_failure():
    exc = Exception('password authentication failed for user "postgres"')
    res = categorize_db_error(exc)
    assert res["category"] == "AUTHENTICATION_FAILURE"
    assert "authentication failed" in res["message"].lower()


def test_categorize_db_error_timeout():
    exc = Exception("connection timed out after 3000ms")
    res = categorize_db_error(exc)
    assert res["category"] == "CONNECTION_TIMEOUT"


def test_categorize_db_error_connection_refused():
    exc = Exception("connection to server failed: Connection refused (0x0000274D/10061)")
    res = categorize_db_error(exc)
    assert res["category"] == "CONNECTION_REFUSED"


def test_categorize_db_error_ssl_failure():
    exc = Exception("SSL error: certificate verify failed")
    res = categorize_db_error(exc)
    assert res["category"] == "SSL_FAILURE"


def test_categorize_db_error_schema_error():
    exc = Exception('relation "assessments" does not exist')
    res = categorize_db_error(exc)
    assert res["category"] == "SCHEMA_ERROR"


def test_diagnose_database_connection_healthy():
    engine = create_engine("sqlite:///:memory:")
    res = diagnose_database_connection(target_engine=engine)
    assert res["connected"] is True
    assert res["status"] == "healthy"
    assert res["dialect"] == "sqlite"
    assert res["failure_category"] is None
    assert res["latency_ms"] >= 0.0


def test_diagnose_database_connection_failure():
    mock_engine = MagicMock()
    mock_engine.dialect.name = "postgresql"
    mock_engine.dialect.driver = "psycopg2"
    mock_engine.connect.side_effect = Exception("FATAL: (ENOTFOUND) tenant/user postgres.invalid not found")
    
    res = diagnose_database_connection(target_engine=mock_engine)
    assert res["connected"] is False
    assert res["status"] == "unavailable"
    assert res["dialect"] == "postgresql"
    assert res["failure_category"] == "TENANT_OR_USER_NOT_FOUND"


def test_admin_database_diagnostics_endpoint_access(client, db_session):
    # Create admin user
    admin_user = models.User(
        uid="admin_diag_user",
        email="admin_diag@msme.com",
        name="Admin Diag",
        role="admin",
        approval_status="approved"
    )
    # Create standard user
    regular_user = models.User(
        uid="regular_diag_user",
        email="regular_diag@msme.com",
        name="Regular Diag",
        role="user",
        approval_status="approved"
    )
    db_session.add(admin_user)
    db_session.add(regular_user)
    db_session.commit()

    admin_headers = {"Authorization": "Bearer test_token:admin_diag_user:admin_diag@msme.com:Admin Diag"}
    regular_headers = {"Authorization": "Bearer test_token:regular_diag_user:regular_diag@msme.com:Regular Diag"}

    # Admin access succeeds
    resp = client.get("/api/admin/system/database-diagnostics", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "connectivity" in data
    assert "dialect" in data
    assert "alembic_head" in data
    assert data["alembic_head"] == "i1a2b3c4d5e6"

    # Regular user is forbidden
    forbidden_resp = client.get("/api/admin/system/database-diagnostics", headers=regular_headers)
    assert forbidden_resp.status_code == 403

    # Unauthenticated is unauthorized
    unauth_resp = client.get("/api/admin/system/database-diagnostics")
    assert unauth_resp.status_code in [401, 403]


def test_readiness_probe_failure_code_503(client):
    # Patch diagnose_database_connection to simulate database down
    with patch("app.routes.health.diagnose_database_connection") as mock_diag:
        mock_diag.return_value = {
            "connected": False,
            "status": "unavailable",
            "dialect": "postgresql",
            "driver": "psycopg2",
            "latency_ms": 1.2,
            "failure_category": "TENANT_OR_USER_NOT_FOUND",
            "message": "Tenant not found"
        }
        resp = client.get("/api/ready")
        assert resp.status_code == 503
        data = resp.json()
        assert data["ready"] is False
        assert data["database"] == "not_ready"
        assert data["database_failure_category"] == "TENANT_OR_USER_NOT_FOUND"
