import pytest
from app.database import models

SAMPLE_PAYLOAD = {
    "name": "Apex Tooling Ltd",
    "industry": "Manufacturing",
    "age": 7,
    "employees": 35,
    "annual_revenue": 2100000.0,
    "monthly_cash_flow": 140000.0,
    "monthly_expenses": 85000.0,
    "existing_debt": 250000.0,
    "digital_transactions": 380,
    "utility_payment_score": 90.0,
    "invoice_payment_score": 86.0,
    "previous_defaults": 0
}

def test_predict_requires_auth(client):
    response = client.post("/api/predict", json=SAMPLE_PAYLOAD)
    assert response.status_code == 401

def test_predict_risk_success_and_response_schema(client, auth_headers_user1, db_session):
    response = client.post("/api/predict", json=SAMPLE_PAYLOAD, headers=auth_headers_user1)
    assert response.status_code == 200
    data = response.json()

    assert "assessment_id" in data
    assert isinstance(data["default_probability"], (int, float))
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert isinstance(data["confidence"], (int, float))
    assert isinstance(data["top_factors"], list)
    assert len(data["top_factors"]) > 0
    assert isinstance(data["positive_factors"], list)
    assert isinstance(data["risk_factors"], list)

    # Verify DB records created
    assessment_id = data["assessment_id"]
    assessment = db_session.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    assert assessment is not None
    assert assessment.business.user_id == "user_alpha_1"
    assert assessment.business.name == "Apex Tooling Ltd"
    assert assessment.prediction is not None
    assert assessment.report is not None

def test_predict_risk_validation_error(client, auth_headers_user1):
    # Negative revenue or invalid industry
    invalid_payload = {**SAMPLE_PAYLOAD, "annual_revenue": -5000}
    response = client.post("/api/predict", json=invalid_payload, headers=auth_headers_user1)
    assert response.status_code == 422
