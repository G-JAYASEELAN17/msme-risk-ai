import pytest
from fastapi.testclient import TestClient

def test_simulate_risk_with_baseline_data(client: TestClient, test_user_headers: dict):
    payload = {
        "baseline_data": {
            "name": "Acme Simulation Test",
            "industry": "Manufacturing",
            "age": 5,
            "employees": 20,
            "annual_revenue": 2000000.0,
            "monthly_cash_flow": 100000.0,
            "monthly_expenses": 80000.0,
            "existing_debt": 400000.0,
            "digital_transactions": 300,
            "utility_payment_score": 85.0,
            "invoice_payment_score": 80.0,
            "previous_defaults": 0
        },
        "simulated_annual_revenue": 3500000.0,
        "simulated_existing_debt": 100000.0
    }

    res = client.post("/api/predict/simulate", json=payload, headers=test_user_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["is_hypothetical"] is True
    assert "baseline" in data
    assert "simulated" in data
    assert "probability_delta" in data
    # Lower debt and higher revenue should improve (reduce) default probability
    assert data["simulated"]["default_probability"] <= data["baseline"]["default_probability"]
    assert len(data["summary_of_changes"]) >= 2

def test_simulate_risk_missing_data_returns_400(client: TestClient, test_user_headers: dict):
    res = client.post("/api/predict/simulate", json={}, headers=test_user_headers)
    assert res.status_code == 400
