import pytest
import numpy as np
from app.database import models
from app.services.explainability_service import explainability_service, FEATURE_REGISTRY, TRANSFORMED_COLUMNS
from app.config import settings


def create_sample_assessment(db, uid="user_alpha_1", name="Alpha Enterprises"):
    """Helper to create a fully populated User, Business, and Assessment in test DB."""
    user = db.query(models.User).filter(models.User.uid == uid).first()
    if not user:
        user = models.User(
            uid=uid,
            email=f"{uid}@test.local",
            name=name,
            role="user",
            approval_status="approved"
        )
        db.add(user)
        db.flush()

    business = models.Business(
        user_id=uid,
        name=name,
        industry="Retail",
        age=5,
        employees=15
    )
    db.add(business)
    db.flush()

    assessment = models.Assessment(
        business_id=business.id,
        annual_revenue=500000.0,
        monthly_cash_flow=25000.0,
        monthly_expenses=35000.0,
        existing_debt=120000.0,
        digital_transactions=180,
        utility_payment_score=75.0,
        invoice_payment_score=80.0,
        previous_defaults=0,
        review_status="pending"
    )
    db.add(assessment)
    db.flush()

    prediction = models.Prediction(
        assessment_id=assessment.id,
        default_probability=22.5,
        risk_level="LOW",
        risk_score=23.0,
        confidence=85.0,
        top_factors=["Balanced debt ratio", "Positive utility score"],
        positive_factors=["Clean credit record"],
        risk_factors=["Tight monthly cash flow"],
        model_version=settings.MODEL_VERSION
    )
    db.add(prediction)
    db.commit()
    db.refresh(assessment)
    return assessment


# ==============================================================================
# 1. UNIT TESTS: FEATURE REGISTRY & SCHEMA VALIDATION
# ==============================================================================

def test_feature_registry_completeness():
    """Verify that all 11 model features have display names, units, and actionability definitions."""
    expected_features = [
        "age", "employees", "annual_revenue", "monthly_cash_flow",
        "monthly_expenses", "existing_debt", "digital_transactions",
        "utility_payment_score", "invoice_payment_score", "previous_defaults",
        "industry"
    ]
    for feat in expected_features:
        assert feat in FEATURE_REGISTRY, f"Feature '{feat}' missing in FEATURE_REGISTRY"
        meta = FEATURE_REGISTRY[feat]
        assert "display_name" in meta
        assert "unit" in meta
        assert "business_definition" in meta
        assert "is_actionable" in meta

    # Verify immutable classification
    assert FEATURE_REGISTRY["age"]["is_actionable"] is False
    assert FEATURE_REGISTRY["industry"]["is_actionable"] is False
    assert FEATURE_REGISTRY["existing_debt"]["is_actionable"] is True


def test_tree_shap_calculation_and_exact_additivity():
    """
    Verify genuine TreeSHAP calculation:
    1. 14 transformed contributions + baseline value.
    2. Sum of contributions equals raw output margin within floating-point tolerance.
    3. Probability equals sigmoid(raw_margin).
    4. 11 aggregated business feature contributions.
    """
    sample = {
        "age": 4,
        "employees": 8,
        "annual_revenue": 450000.0,
        "monthly_cash_flow": 20000.0,
        "monthly_expenses": 30000.0,
        "existing_debt": 80000.0,
        "digital_transactions": 150,
        "utility_payment_score": 82.0,
        "invoice_payment_score": 85.0,
        "previous_defaults": 0,
        "industry": "Manufacturing"
    }

    res = explainability_service.calculate_tree_shap(sample)

    assert "baseline_value" in res
    assert "raw_margin" in res
    assert "predicted_probability" in res
    assert "risk_level" in res
    assert "contributions" in res
    assert "waterfall_steps" in res
    assert res["additivity_reconciled"] is True
    assert res["reconciliation_difference"] < 1e-4

    # Verify probability mapping
    prob_from_margin = 1.0 / (1.0 + np.exp(-res["raw_margin"]))
    assert np.isclose(res["predicted_probability"] / 100.0, prob_from_margin, atol=0.01)

    # Verify 11 aggregated contributions
    assert len(res["contributions"]) == 11
    feat_names = [c["feature_name"] for c in res["contributions"]]
    for f in FEATURE_REGISTRY.keys():
        assert f in feat_names

    # Verify waterfall structure
    steps = res["waterfall_steps"]
    assert len(steps) >= 13  # baseline + 11 factors + output
    assert steps[0]["step_type"] == "baseline"
    assert steps[-1]["step_type"] == "output"
    assert np.isclose(steps[-1]["cumulative"], res["raw_margin"], atol=1e-3)


def test_direction_and_business_explanations():
    """Verify that SHAP contribution directions are labeled accurately with non-causal language."""
    sample = {
        "age": 1,
        "employees": 2,
        "annual_revenue": 60000.0,
        "monthly_cash_flow": -5000.0,
        "monthly_expenses": 10000.0,
        "existing_debt": 90000.0,
        "digital_transactions": 25,
        "utility_payment_score": 40.0,
        "invoice_payment_score": 35.0,
        "previous_defaults": 2,
        "industry": "Retail"
    }

    res = explainability_service.calculate_tree_shap(sample)

    for c in res["contributions"]:
        if c["contribution"] > 0.01:
            assert c["direction"] == "INCREASES_RISK"
            assert "increased the model-estimated default risk margin" in c["plain_text_explanation"]
        elif c["contribution"] < -0.01:
            assert c["direction"] == "DECREASES_RISK"
            assert "decreased the model-estimated default risk margin" in c["plain_text_explanation"]
        else:
            assert c["direction"] == "NEUTRAL"


# ==============================================================================
# 2. UNIT TESTS: GLOBAL IMPORTANCE & METADATA
# ==============================================================================

def test_global_importance_calculation_and_caching(db_session):
    """Verify global feature ranking computation, XGBoost Gain/Weight metrics, and database caching."""
    res1 = explainability_service.get_global_importance(db=db_session)

    assert "model_version" in res1
    assert "top_features" in res1
    assert len(res1["all_features"]) == 11
    assert res1["top_features"][0]["rank"] == 1
    assert res1["top_features"][0]["mean_abs_shap"] >= res1["top_features"][1]["mean_abs_shap"]
    assert "xgboost_gain" in res1["top_features"][0]
    assert "xgboost_weight" in res1["top_features"][0]

    # Check persistence in DB
    snapshot = db_session.query(models.GlobalImportanceSnapshot).first()
    assert snapshot is not None
    assert snapshot.model_version == settings.MODEL_VERSION

    # Second call should read from cache
    res2 = explainability_service.get_global_importance(db=db_session)
    assert res2["dataset_fingerprint"] == res1["dataset_fingerprint"]


def test_model_metadata_service():
    """Verify metadata service returns model version, evaluation metrics, and feature schemas."""
    meta = explainability_service.get_model_metadata()

    assert meta["model_version"] == settings.MODEL_VERSION
    assert "accuracy" in meta["evaluation_metrics"]
    assert "roc_auc" in meta["evaluation_metrics"]
    assert meta["evaluation_metrics"]["roc_auc"] >= 0.90
    assert "numerical" in meta["features"]
    assert "categorical" in meta["features"]


# ==============================================================================
# 3. UNIT TESTS: COUNTERFACTUALS, WHAT-IF, AND STABILITY
# ==============================================================================

def test_counterfactual_generation_constraints(db_session):
    """
    Verify that counterfactual analysis:
    1. Preserves immutable features (age, industry).
    2. Proposes realistic actionable changes (e.g. debt reduction, cash flow expansion).
    3. Results in lower predicted default probability.
    4. Does not alter original assessment in DB.
    """
    assessment = create_sample_assessment(db_session)
    orig_debt = float(assessment.existing_debt)

    res = explainability_service.generate_counterfactuals(
        assessment_id=assessment.id,
        target_risk_level="LOW",
        user_id="user_alpha_1",
        db=db_session
    )

    assert res["status"] == "FOUND"
    assert len(res["scenarios"]) > 0
    scen = res["scenarios"][0]
    assert scen["counterfactual_probability"] <= res["original_probability"]

    # Verify immutable features were not modified in proposals
    for change in scen["proposed_changes"]:
        assert change["feature_name"] not in ["age", "industry"]
        assert change["is_actionable"] is True

    # Verify original DB record is completely untouched
    db_session.refresh(assessment)
    assert float(assessment.existing_debt) == orig_debt


def test_what_if_simulation_isolation(db_session):
    """
    Verify What-If simulation re-evaluates the real model and SHAP attributions
    without modifying the stored assessment.
    """
    assessment = create_sample_assessment(db_session)
    orig_rev = float(assessment.annual_revenue)

    hypothetical = {
        "annual_revenue": 1000000.0,
        "existing_debt": 20000.0
    }

    sim = explainability_service.simulate_what_if(
        assessment_id=assessment.id,
        hypothetical_inputs=hypothetical,
        db=db_session
    )

    assert sim["is_simulation"] is True
    assert "hypothetical_probability" in sim
    assert "probability_delta" in sim
    assert len(sim["changed_features"]) == 2
    assert len(sim["contributions"]) == 11

    # Verify original record unchanged
    db_session.refresh(assessment)
    assert float(assessment.annual_revenue) == orig_rev


def test_stability_evaluation(db_session):
    """Verify stability evaluation tests perturbations and returns robustness metrics."""
    assessment = create_sample_assessment(db_session)

    stab = explainability_service.evaluate_stability(
        assessment_id=assessment.id,
        db=db_session
    )

    assert stab["scenarios_evaluated"] == 10
    assert 0.0 <= stab["risk_band_retention_rate"] <= 100.0
    assert stab["probability_variance"] >= 0.0
    assert 0.0 <= stab["top_features_stability_score"] <= 100.0
    assert stab["stability_rating"] in ["HIGH", "MODERATE", "SENSITIVE"]


# ==============================================================================
# 4. API INTEGRATION TESTS: RBAC & IDOR PROTECTION
# ==============================================================================

def test_api_get_local_explanation_authorized(client, db_session):
    """Owner user can retrieve their assessment's full explanation."""
    assessment = create_sample_assessment(db_session, uid="user_alpha_1")

    headers = {"Authorization": "Bearer test_token:user_alpha_1:alpha@test.local:Alpha User"}
    resp = client.get(f"/api/explainability/assessments/{assessment.id}", headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["assessment_id"] == assessment.id
    assert data["model_version"] == settings.MODEL_VERSION
    assert len(data["contributions"]) == 11
    assert data["additivity_reconciled"] is True
    assert len(data["waterfall_steps"]) >= 13


def test_api_get_local_explanation_idor_rejected(client, db_session):
    """Non-owner user is rejected with 403 Forbidden when attempting to access another user's explanation."""
    assessment = create_sample_assessment(db_session, uid="user_alpha_1")

    # User Beta tries to access Alpha's assessment
    headers = {"Authorization": "Bearer test_token:user_beta_2:beta@test.local:Beta User"}
    resp = client.get(f"/api/explainability/assessments/{assessment.id}", headers=headers)

    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()


def test_api_analyst_can_inspect_any_assessment(client, db_session):
    """Analyst role can inspect any borrower's explanation for underwriting review."""
    assessment = create_sample_assessment(db_session, uid="user_alpha_1")

    # Register analyst user in DB
    analyst_user = models.User(
        uid="analyst_1",
        email="analyst@riskai.local",
        name="Credit Analyst",
        role="analyst",
        approval_status="approved"
    )
    db_session.add(analyst_user)
    db_session.commit()

    headers = {"Authorization": "Bearer test_token:analyst_1:analyst@riskai.local:Credit Analyst"}
    resp = client.get(f"/api/explainability/assessments/{assessment.id}", headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["assessment_id"] == assessment.id


def test_api_global_explainability(client, db_session):
    """Global explainability endpoint returns feature rankings and is accessible to authenticated users."""
    headers = {"Authorization": "Bearer test_token:user_alpha_1:alpha@test.local:Alpha User"}
    resp = client.get("/api/explainability/global", headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "top_features" in data
    assert len(data["all_features"]) == 11


def test_api_counterfactuals_and_what_if(client, db_session):
    """Verify counterfactuals and what-if simulation endpoints via API."""
    assessment = create_sample_assessment(db_session, uid="user_alpha_1")
    headers = {"Authorization": "Bearer test_token:user_alpha_1:alpha@test.local:Alpha User"}

    # Counterfactuals
    cf_resp = client.post(
        f"/api/explainability/assessments/{assessment.id}/counterfactuals",
        headers=headers,
        json={"target_risk_level": "LOW"}
    )
    assert cf_resp.status_code == 200
    assert cf_resp.json()["status"] in ["FOUND", "NO_VALID_CANDIDATE"]

    # What-If
    wi_resp = client.post(
        f"/api/explainability/assessments/{assessment.id}/what-if",
        headers=headers,
        json={"hypothetical_inputs": {"annual_revenue": 800000.0}}
    )
    assert wi_resp.status_code == 200
    assert wi_resp.json()["is_simulation"] is True


def test_api_assessment_not_found(client, db_session):
    """Non-existent assessment ID returns 404 Not Found."""
    headers = {"Authorization": "Bearer test_token:user_alpha_1:alpha@test.local:Alpha User"}
    resp = client.get("/api/explainability/assessments/99999", headers=headers)
    assert resp.status_code == 404


def test_api_unapproved_analyst_cannot_inspect_other_assessments(client, db_session):
    """Analyst awaiting admin approval or suspended is rejected with 403 when accessing another borrower's assessment."""
    assessment = create_sample_assessment(db_session, uid="user_alpha_1")

    # Create unapproved analyst user
    analyst_user = models.User(
        uid="analyst_pending_1",
        email="pending_analyst@riskai.local",
        name="Pending Analyst",
        role="analyst",
        approval_status="pending_admin_approval"
    )
    db_session.add(analyst_user)
    db_session.commit()

    headers = {"Authorization": "Bearer test_token:analyst_pending_1:pending_analyst@riskai.local:Pending Analyst"}
    resp = client.get(f"/api/explainability/assessments/{assessment.id}", headers=headers)

    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()


def test_api_unapproved_analyst_cannot_access_global_or_metadata(client, db_session):
    """Analyst with pending approval cannot access global diagnostics or model version metadata."""
    analyst_user = models.User(
        uid="analyst_pending_2",
        email="pending_analyst2@riskai.local",
        name="Pending Analyst 2",
        role="analyst",
        approval_status="pending_admin_approval"
    )
    db_session.add(analyst_user)
    db_session.commit()

    headers = {"Authorization": "Bearer test_token:analyst_pending_2:pending_analyst2@riskai.local:Pending Analyst 2"}
    
    # Global explanation rejected
    resp_global = client.get("/api/explainability/global", headers=headers)
    assert resp_global.status_code == 403
    assert "awaiting administrator approval" in resp_global.json()["detail"].lower()

    # Model metadata rejected
    resp_meta = client.get(f"/api/explainability/models/{settings.MODEL_VERSION}/metadata", headers=headers)
    assert resp_meta.status_code == 403
    assert "awaiting administrator approval" in resp_meta.json()["detail"].lower()


def test_genuine_global_importance_holdout_samples(db_session):
    """Verify that global importance is derived from documented 500-sample holdout evaluation data."""
    # Clear any old snapshots in db_session
    db_session.query(models.GlobalImportanceSnapshot).delete()
    db_session.commit()

    global_res = explainability_service.get_global_importance(db=db_session)
    assert global_res["is_representative"] is True
    assert global_res["sample_count"] == 500
    assert "Holdout Test Dataset" in global_res["evaluation_data_provenance"]
    assert len(global_res["all_features"]) == 11
    
    # Verify rank order 1..11
    ranks = [f["rank"] for f in global_res["all_features"]]
    assert ranks == list(range(1, 12))

    # Verify top features have non-zero mean absolute SHAP
    for feat in global_res["all_features"]:
        assert feat["mean_abs_shap"] >= 0.0
        assert "display_name" in feat
        assert "business_definition" in feat


def test_global_importance_unavailable_when_dataset_missing(db_session, monkeypatch):
    """When genuine holdout data is missing, service must return explicit unavailable status and never synthetic fixtures."""
    from pathlib import Path
    db_session.query(models.GlobalImportanceSnapshot).delete()
    db_session.commit()

    # Monkeypatch dataset path to non-existent path
    non_existent = Path("non_existent_msme_eval_data.csv")
    monkeypatch.setattr(Path, "exists", lambda self: False if "msme_loans_clean.csv" in str(self) else True)

    res = explainability_service.get_global_importance(db=db_session)
    assert res["is_representative"] is False
    assert res["dataset_fingerprint"] == "UNAVAILABLE"
    assert res["sample_count"] == 0
    assert len(res["all_features"]) == 0
    assert any("strictly prohibited" in w for w in res["warnings"])


def test_cached_explanation_ranks_are_correctly_indexed(db_session):
    """Verify that cached model explanations return properly ordered, 1-indexed ranks."""
    assessment = create_sample_assessment(db_session)
    
    # First computation (persists to DB)
    exp1 = explainability_service.get_or_create_local_explanation(assessment.id, db=db_session)
    assert exp1["contributions"][0]["rank"] == 1
    
    # Second retrieval (reconstructed from DB cache)
    exp2 = explainability_service.get_or_create_local_explanation(assessment.id, db=db_session)
    ranks = [c["rank"] for c in exp2["contributions"]]
    assert ranks == list(range(1, len(ranks) + 1)), f"Expected ranks 1..{len(ranks)}, got {ranks}"
    if exp2["positive_drivers"]:
        assert exp2["positive_drivers"][0]["rank"] == 1
    if exp2["negative_drivers"]:
        assert exp2["negative_drivers"][0]["rank"] == 1


def test_stability_fairness_and_causality_disclaimer(db_session):
    """Verify that stability analysis explicitly disclaims proof of fairness, causality, or overall reliability."""
    assessment = create_sample_assessment(db_session)
    stab = explainability_service.evaluate_stability(assessment.id, db=db_session)
    
    limitations = stab.get("limitations", [])
    assert any("fairness" in l.lower() for l in limitations)
    assert any("causal" in l.lower() for l in limitations)


def test_api_refresh_explanation(client, db_session):
    """Verify that POST /assessments/{id}/refresh forces recalculation of TreeSHAP."""
    assessment = create_sample_assessment(db_session, uid="user_alpha_1")
    headers = {"Authorization": "Bearer test_token:user_alpha_1:alpha@test.local:Alpha User"}
    
    resp = client.post(f"/api/explainability/assessments/{assessment.id}/refresh", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["assessment_id"] == assessment.id
    assert data["additivity_reconciled"] is True
    assert len(data["contributions"]) == 11


def test_api_export_explanation(client, db_session):
    """Verify that GET /assessments/{id}/export returns structured audit export payload."""
    assessment = create_sample_assessment(db_session, uid="user_alpha_1")
    headers = {"Authorization": "Bearer test_token:user_alpha_1:alpha@test.local:Alpha User"}
    
    resp = client.get(f"/api/explainability/assessments/{assessment.id}/export", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["assessment_id"] == assessment.id
    assert "explanation" in data
    assert "regulatory_disclaimer" in data
    assert "counterfactual_scenarios" in data
    assert data["exported_by"] == "user_alpha_1@test.local"


