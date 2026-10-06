import pytest

SAMPLE_PAYLOAD = {
    "name": "Delta Logistics",
    "industry": "Logistics",
    "age": 6,
    "employees": 28,
    "annual_revenue": 1800000.0,
    "monthly_cash_flow": 120000.0,
    "monthly_expenses": 90000.0,
    "existing_debt": 200000.0,
    "digital_transactions": 600,
    "utility_payment_score": 91.0,
    "invoice_payment_score": 89.0,
    "previous_defaults": 0
}

def test_report_retrieval_and_structure(client, auth_headers_user1):
    # Create assessment
    res = client.post("/api/predict", json=SAMPLE_PAYLOAD, headers=auth_headers_user1)
    assessment_id = res.json()["assessment_id"]

    # Fetch report
    report_res = client.get(f"/api/reports/{assessment_id}", headers=auth_headers_user1)
    assert report_res.status_code == 200
    report = report_res.json()

    assert "metadata" in report
    assert "report_id" in report["metadata"]
    assert "business" in report
    assert report["business"]["name"] == "Delta Logistics"
    assert "financial_summary" in report
    assert "debt_to_revenue_ratio" in report["financial_summary"]
    assert "alternative_indicators" in report
    assert "risk_assessment" in report
    assert "default_probability" in report["risk_assessment"]

def test_unauthorized_user_cannot_access_report(client, auth_headers_user1, auth_headers_user2):
    # User 1 creates assessment
    res = client.post("/api/predict", json=SAMPLE_PAYLOAD, headers=auth_headers_user1)
    assessment_id = res.json()["assessment_id"]

    # User 2 attempts to fetch User 1's report
    cross_res = client.get(f"/api/reports/{assessment_id}", headers=auth_headers_user2)
    assert cross_res.status_code == 403
    assert "Not authorized" in cross_res.json()["detail"]

def test_nonexistent_report_returns_404(client, auth_headers_user1):
    res = client.get("/api/reports/999999", headers=auth_headers_user1)
    assert res.status_code == 404
