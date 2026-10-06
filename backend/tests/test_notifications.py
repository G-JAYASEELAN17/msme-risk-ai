import pytest
from fastapi.testclient import TestClient

def test_notifications_and_alert_rules(client: TestClient, test_user_headers: dict):
    # 1. Create alert rule
    rule_payload = {
        "name": "High Probability Warning",
        "rule_type": "high_risk_detected",
        "threshold": 60.0,
        "is_active": True
    }
    res = client.post("/api/notifications/alerts/rules", json=rule_payload, headers=test_user_headers)
    assert res.status_code == 201
    rule_id = res.json()["id"]

    # 2. Get alert rules
    res = client.get("/api/notifications/alerts/rules", headers=test_user_headers)
    assert res.status_code == 200
    assert any(r["id"] == rule_id for r in res.json())

    # 3. Trigger high risk assessment to verify notification generation
    high_risk_payload = {
        "name": "Risky Business Corp",
        "industry": "Retail",
        "age": 1,
        "employees": 5,
        "annual_revenue": 500000.0,
        "monthly_cash_flow": -20000.0,
        "monthly_expenses": 70000.0,
        "existing_debt": 600000.0,
        "digital_transactions": 20,
        "utility_payment_score": 40.0,
        "invoice_payment_score": 45.0,
        "previous_defaults": 2
    }
    pred_res = client.post("/api/predict", json=high_risk_payload, headers=test_user_headers)
    assert pred_res.status_code == 200

    # 4. Check notifications
    res = client.get("/api/notifications", headers=test_user_headers)
    assert res.status_code == 200
    notifs = res.json()
    assert len(notifs) >= 1

    # 5. Mark read
    notif_id = notifs[0]["id"]
    res = client.put(f"/api/notifications/{notif_id}/read", headers=test_user_headers)
    assert res.status_code == 200
    assert res.json()["is_read"] is True

    # 6. Delete alert rule
    res = client.delete(f"/api/notifications/alerts/rules/{rule_id}", headers=test_user_headers)
    assert res.status_code == 204
