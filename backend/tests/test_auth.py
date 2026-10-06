import pytest
from unittest.mock import patch
from app.database import models
from app.auth import verify_token_claims
from fastapi import HTTPException

def test_missing_auth_header_returns_401(client):
    response = client.get("/api/assessments")
    assert response.status_code == 401
    assert "Authorization header missing" in response.json()["detail"]

def test_invalid_bearer_token_format_returns_401(client):
    response = client.get("/api/assessments", headers={"Authorization": "InvalidTokenWithoutBearer"})
    assert response.status_code == 401

def test_valid_bearer_token_authenticates_and_upserts_user(client, auth_headers_user1, db_session):
    response = client.get("/api/assessments", headers=auth_headers_user1)
    assert response.status_code == 200
    assert response.json() == []

    # Verify user was automatically upserted into users table
    user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    assert user is not None
    assert user.email == "alpha@msme.com"
    assert user.name == "Alpha Risk Officer"

def test_x_user_uid_header_is_ignored_without_bearer(client):
    response = client.get("/api/assessments", headers={"X-User-UID": "injected_fake_user"})
    assert response.status_code == 401
    assert "Authorization header missing" in response.json()["detail"]

def test_x_user_uid_cannot_spoof_token_identity(client, auth_headers_user1, db_session):
    # Pass both valid bearer for user_alpha_1 and an attempted spoofing X-User-UID header
    headers = {**auth_headers_user1, "X-User-UID": "spoofed_admin_user"}
    response = client.get("/api/assessments", headers=headers)
    assert response.status_code == 200
    
    # Spoofed user must NOT exist
    spoofed_user = db_session.query(models.User).filter(models.User.uid == "spoofed_admin_user").first()
    assert spoofed_user is None
    
    # Authenticated user is strictly user_alpha_1
    alpha_user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    assert alpha_user is not None

def test_firebase_verify_id_token_failure_raises_401(client):
    with patch("firebase_admin.auth.verify_id_token", side_effect=Exception("Firebase ID token has expired")):
        response = client.get("/api/assessments", headers={"Authorization": "Bearer expired_or_invalid_raw_token"})
        assert response.status_code == 401
        assert "Invalid or expired authentication token" in response.json()["detail"]

def test_firebase_verify_id_token_success(client, db_session):
    mock_claims = {
        "uid": "firebase_verified_uid_123",
        "email": "verified@firebase.org",
        "name": "Verified Officer"
    }
    with patch("firebase_admin.auth.verify_id_token", return_value=mock_claims):
        response = client.get("/api/assessments", headers={"Authorization": "Bearer valid_live_firebase_token"})
        assert response.status_code == 200
        
        user = db_session.query(models.User).filter(models.User.uid == "firebase_verified_uid_123").first()
        assert user is not None
        assert user.email == "verified@firebase.org"
        assert user.name == "Verified Officer"
