import pytest
from fastapi.testclient import TestClient
from app.database import models
from app.services.risk_intelligence_service import (
    calculate_data_quality_score,
    calculate_risk_score,
    categorize_factors,
    generate_analyst_summary,
    compute_risk_trend,
)
from app.services.model_registry import get_model_metadata, get_model_card

SAMPLE_PAYLOAD_1 = {
    "name": "Titan Industrial Works",
    "industry": "Manufacturing",
    "age": 8,
    "employees": 42,
    "annual_revenue": 2500000.0,
    "monthly_cash_flow": 160000.0,
    "monthly_expenses": 95000.0,
    "existing_debt": 220000.0,
    "digital_transactions": 450,
    "utility_payment_score": 92.0,
    "invoice_payment_score": 88.0,
    "previous_defaults": 0,
    "loan_amount": 150000.0,
    "loan_tenure": 24,
}

SAMPLE_PAYLOAD_DISTRESSED = {
    "name": "Titan Industrial Works",
    "industry": "Manufacturing",
    "age": 8,
    "employees": 42,
    "annual_revenue": 800000.0,
    "monthly_cash_flow": -15000.0,
    "monthly_expenses": 75000.0,
    "existing_debt": 600000.0,
    "digital_transactions": 80,
    "utility_payment_score": 45.0,
    "invoice_payment_score": 40.0,
    "previous_defaults": 2,
    "loan_amount": 250000.0,
    "loan_tenure": 12,
}


def test_prediction_persistence_and_fields(client: TestClient, auth_headers_user1: dict, db_session):
    """1. Prediction persistence and all risk intelligence fields stored in DB."""
    resp = client.post("/api/predict", json=SAMPLE_PAYLOAD_1, headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()

    assert "assessment_id" in data
    assert "risk_score" in data
    assert 0.0 <= data["risk_score"] <= 100.0
    assert "data_quality_score" in data
    assert 0.0 <= data["data_quality_score"] <= 100.0
    assert data["data_quality_tier"] in ["High Quality", "Medium Quality", "Low Quality"]
    assert data["model_version"] == "1.1.0"
    assert "factor_breakdown" in data
    assert "analyst_summary" in data
    assert len(data["analyst_summary"]) > 20

    # Verify database persistence in predictions table
    pred_db = (
        db_session.query(models.Prediction)
        .filter(models.Prediction.assessment_id == data["assessment_id"])
        .first()
    )
    assert pred_db is not None
    assert pred_db.risk_score is not None
    assert pred_db.data_quality_score is not None
    assert pred_db.factor_breakdown is not None
    assert pred_db.analyst_summary is not None
    assert pred_db.model_version == "1.1.0"


def test_model_version_tracking(client: TestClient, auth_headers_user1: dict, db_session):
    """2. Model version tracking records 1.1.0 on prediction and audit logs."""
    resp = client.post("/api/predict", json=SAMPLE_PAYLOAD_1, headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()
    assert data["model_version"] == "1.1.0"

    # Verify audit log recorded MODEL_VERSION_USED and PREDICTION_CREATED
    audit_events = (
        db_session.query(models.AuditLog)
        .all()
    )
    actions = [a.action for a in audit_events]
    assert "PREDICTION_CREATED" in actions
    assert "MODEL_VERSION_USED" in actions


def test_risk_score_calculation_and_bands():
    """3 & 4. Risk score normalization from 0-100 aligned with low, medium, and high bands."""
    # 0–24 = LOW, 25–55 = MEDIUM, 56–100 = HIGH
    score_low = calculate_risk_score(4.2)
    assert 0.0 <= score_low <= 24.0

    score_med = calculate_risk_score(35.0)
    assert 25.0 <= score_med <= 55.0

    score_high = calculate_risk_score(85.0)
    assert 56.0 <= score_high <= 100.0


def test_shap_explanation_seven_categories():
    """5. Categorized SHAP feature attributions across 7 analytical dimensions."""
    breakdown = categorize_factors(SAMPLE_PAYLOAD_1)
    known_cats = [
        "Financial Strength",
        "Cash Flow",
        "Debt Burden",
        "Revenue Stability",
        "Transaction Behaviour",
        "Payment Behaviour",
        "Alternative Signals",
    ]
    for c in known_cats:
        assert c in breakdown
        assert len(breakdown[c]) > 0
        factor = breakdown[c][0]
        assert "feature" in factor
        assert "display_name" in factor
        assert "impact" in factor
        assert "direction" in factor
        assert "explanation" in factor
        assert len(factor["explanation"]) > 10


def test_data_quality_scoring():
    """6. Data quality scoring heuristics and tiering."""
    high_score, high_tier, issues = calculate_data_quality_score(SAMPLE_PAYLOAD_1)
    assert high_score >= 85.0
    assert high_tier == "High Quality"

    # Degraded payload with missing values and extreme debt
    sparse_payload = {
        "name": "Sparse Business",
        "industry": "Retail",
        "annual_revenue": 10000.0,
        "monthly_cash_flow": -50000.0,
        "monthly_expenses": 60000.0,
        "existing_debt": 900000.0,
    }
    low_score, low_tier, low_issues = calculate_data_quality_score(sparse_payload)
    assert low_score < high_score
    assert len(low_issues) > 0


def test_prediction_history_and_idor(client: TestClient, auth_headers_user1: dict, auth_headers_user2: dict):
    """7. Prediction history retrieval and user isolation."""
    # User 1 makes a prediction
    resp1 = client.post("/api/predict", json=SAMPLE_PAYLOAD_1, headers=auth_headers_user1)
    assert resp1.status_code == 200
    pred1_id = resp1.json()["assessment_id"]

    # User 1 fetches history -> should contain their prediction
    hist_resp1 = client.get("/api/predictions/history", headers=auth_headers_user1)
    assert hist_resp1.status_code == 200
    hist1 = hist_resp1.json()
    assert len(hist1) >= 1
    assert any(item["assessment_id"] == pred1_id for item in hist1)

    # User 2 fetches history -> should NOT see User 1's prediction
    hist_resp2 = client.get("/api/predictions/history", headers=auth_headers_user2)
    assert hist_resp2.status_code == 200
    hist2 = hist_resp2.json()
    assert not any(item["assessment_id"] == pred1_id for item in hist2)

    # User 2 attempts to directly access User 1's prediction ID -> 403 or 404
    pred_item_resp = client.get(f"/api/predictions/{pred1_id}", headers=auth_headers_user2)
    assert pred_item_resp.status_code in [403, 404]


def test_multi_assessment_risk_trend(client: TestClient, auth_headers_user1: dict, db_session):
    """8. Risk trend tracking across multiple assessments for same business."""
    # First assessment: healthy financials
    resp1 = client.post("/api/predict", json=SAMPLE_PAYLOAD_1, headers=auth_headers_user1)
    assert resp1.status_code == 200
    pred1 = resp1.json()
    first_pred_id = (
        db_session.query(models.Prediction)
        .filter(models.Prediction.assessment_id == pred1["assessment_id"])
        .first()
        .id
    )

    # Check trend on first prediction -> Stable / First assessment
    trend_resp1 = client.get(f"/api/predictions/{first_pred_id}/risk-trend", headers=auth_headers_user1)
    assert trend_resp1.status_code == 200
    trend_data1 = trend_resp1.json()
    assert trend_data1["trend"] == "STABLE"

    # Second assessment: distressed financials on same business name
    resp2 = client.post("/api/predict", json=SAMPLE_PAYLOAD_DISTRESSED, headers=auth_headers_user1)
    assert resp2.status_code == 200
    pred2 = resp2.json()
    second_pred_id = (
        db_session.query(models.Prediction)
        .filter(models.Prediction.assessment_id == pred2["assessment_id"])
        .first()
        .id
    )

    trend_resp2 = client.get(f"/api/predictions/{second_pred_id}/risk-trend", headers=auth_headers_user1)
    assert trend_resp2.status_code == 200
    trend_data2 = trend_resp2.json()
    assert trend_data2["trend"] == "INCREASING_RISK"
    assert trend_data2["previous_probability"] is not None


def test_what_if_simulation_intelligence(client: TestClient, auth_headers_user1: dict):
    """9. Counterfactual What-If scenario simulation with hypothetical disclaimer."""
    sim_payload = {
        "baseline_data": SAMPLE_PAYLOAD_1,
        "simulated_annual_revenue": 3500000.0,
        "simulated_monthly_cash_flow": 220000.0,
        "simulated_existing_debt": 100000.0,
        "simulated_loan_amount": 200000.0,
        "simulated_loan_tenure": 36,
    }
    resp = client.post("/api/simulate", json=sim_payload, headers=auth_headers_user1)
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_hypothetical"] is True
    assert "hypothetical" in data["disclaimer"].lower()
    assert "baseline" in data
    assert "simulated" in data
    assert "probability_delta" in data
    assert "summary_of_changes" in data
    assert len(data["summary_of_changes"]) > 0


def test_admin_model_monitoring_and_date_filtering(
    client: TestClient, auth_headers_user1: dict, db_session
):
    """10, 11, 12. Admin Model Monitoring and RBAC enforcement."""
    # Ensure user1 is admin
    user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user:
        user = models.User(uid="user_alpha_1", email="alpha@msme.com", role="admin")
        db_session.add(user)
    else:
        user.role = "admin"
    db_session.commit()

    # Admin requests with different date windows
    for days_param in ["7", "30", "90", ""]:
        url = f"/api/admin/model-monitoring?days={days_param}" if days_param else "/api/admin/model-monitoring"
        resp = client.get(url, headers=auth_headers_user1)
        assert resp.status_code == 200
        data = resp.json()
        assert "model_version" in data
        assert "total_predictions" in data
        assert "risk_distribution" in data
        assert "risk_percentages" in data
        assert "average_probability" in data
        assert "drift_summary" in data


def test_user_cannot_access_model_monitoring(client: TestClient, auth_headers_user2: dict, db_session):
    """12. Normal user is forbidden from accessing Admin Model Monitoring."""
    user2 = db_session.query(models.User).filter(models.User.uid == "user_beta_2").first()
    if not user2:
        user2 = models.User(uid="user_beta_2", email="beta@msme.com", role="user")
        db_session.add(user2)
    else:
        user2.role = "user"
    db_session.commit()

    resp = client.get("/api/admin/model-monitoring", headers=auth_headers_user2)
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["detail"]

    resp = client.get("/api/admin/model-card", headers=auth_headers_user2)
    assert resp.status_code == 403


def test_model_metadata_and_card_unfabricated(client: TestClient, auth_headers_user1: dict, db_session):
    """14 & 17. Model metadata verified against model_metadata.json without fabricated metrics."""
    user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user:
        user = models.User(uid="user_alpha_1", email="alpha@msme.com", role="admin")
        db_session.add(user)
    else:
        user.role = "admin"
    db_session.commit()

    resp = client.get("/api/admin/model-card", headers=auth_headers_user1)
    assert resp.status_code == 200
    card = resp.json()

    assert card["model_overview"]["version"] == "1.1.0"
    assert card["model_overview"]["algorithm"] == "XGBoost"
    assert card["training_and_evaluation"]["evaluation_metrics"]["roc_auc"] == 0.9647
    assert card["training_and_evaluation"]["evaluation_metrics"]["accuracy"] == 0.918
    assert card["training_and_evaluation"]["evaluation_metrics"]["precision"] == 0.781
    assert card["training_and_evaluation"]["evaluation_metrics"]["recall"] == 0.82
    assert card["training_and_evaluation"]["evaluation_metrics"]["f1_score"] == 0.80
    assert "AI-assisted credit risk decision support" in card["responsible_ai_notice"]


def test_missing_baseline_statistics_handling(client: TestClient, auth_headers_user1: dict, db_session):
    """15. Missing baseline statistics must output 'Baseline statistics unavailable.' without fabricating drift."""
    user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user:
        user = models.User(uid="user_alpha_1", email="alpha@msme.com", role="admin")
        db_session.add(user)
    else:
        user.role = "admin"
    db_session.commit()

    resp = client.get("/api/admin/model-monitoring", headers=auth_headers_user1)
    assert resp.status_code == 200
    drift_data = resp.json()["drift_summary"]

    assert "Baseline statistics unavailable." in drift_data["overall_status"]
    for feat_name, feat_info in drift_data["monitored_features"].items():
        assert feat_info["baseline_status"] == "Baseline statistics unavailable."
        assert feat_info["baseline_mean"] is None


def test_audit_logs_for_prediction_lifecycle(client: TestClient, auth_headers_user1: dict, db_session):
    """16 & 19. Audit events recorded for PREDICTION_CREATED, PREDICTION_VIEWED, WHAT_IF_SIMULATION_RUN."""
    # 1. Create prediction
    resp = client.post("/api/predict", json=SAMPLE_PAYLOAD_1, headers=auth_headers_user1)
    assert resp.status_code == 200
    pred_data = resp.json()
    assessment_id = pred_data["assessment_id"]

    pred_rec = (
        db_session.query(models.Prediction)
        .filter(models.Prediction.assessment_id == assessment_id)
        .first()
    )

    # 2. View prediction explanation
    exp_resp = client.get(f"/api/predictions/{pred_rec.id}/explanation", headers=auth_headers_user1)
    assert exp_resp.status_code == 200

    # 3. Run What-If simulation
    sim_resp = client.post(
        "/api/simulate",
        json={"assessment_id": assessment_id, "simulated_annual_revenue": 3000000.0},
        headers=auth_headers_user1,
    )
    assert sim_resp.status_code == 200

    # Verify audit log actions in DB
    logs = db_session.query(models.AuditLog).all()
    actions = [l.action for l in logs]

    assert "PREDICTION_CREATED" in actions
    assert "MODEL_VERSION_USED" in actions
    assert "PREDICTION_EXPLANATION_VIEWED" in actions
    assert "WHAT_IF_SIMULATION_RUN" in actions
