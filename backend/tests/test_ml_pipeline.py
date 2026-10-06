import pytest
import pandas as pd
import numpy as np
from ml.preprocessing.preprocess import clean_data, NUMERICAL_FEATURES, CATEGORICAL_FEATURES
from app.services.preprocessing import preprocessing_service
from app.services.prediction_service import prediction_service

def test_clean_data_handles_missing_and_outliers():
    raw_df = pd.DataFrame([{
        "industry": "Retail",
        "age": -5,
        "employees": 10,
        "annual_revenue": -1000,
        "utility_payment_score": 150.0,
        "invoice_payment_score": -10.0
    }])
    cleaned = clean_data(raw_df)

    assert cleaned["age"].iloc[0] == 0
    assert cleaned["annual_revenue"].iloc[0] == 0
    assert cleaned["utility_payment_score"].iloc[0] == 100.0
    assert cleaned["invoice_payment_score"].iloc[0] == 0.0
    assert "monthly_cash_flow" in cleaned.columns

def test_preprocessing_single_sample():
    sample = {
        "name": "Test Co",
        "industry": "Manufacturing",
        "age": 5,
        "employees": 20,
        "annual_revenue": 1000000.0,
        "monthly_cash_flow": 80000.0,
        "monthly_expenses": 50000.0,
        "existing_debt": 150000.0,
        "digital_transactions": 300,
        "utility_payment_score": 85.0,
        "invoice_payment_score": 80.0,
        "previous_defaults": 0
    }
    transformed = preprocessing_service.preprocess_single(sample)
    assert isinstance(transformed, np.ndarray)
    assert transformed.shape[0] == 1

def test_prediction_service_explainability_factors():
    sample = {
        "name": "High Risk Inc",
        "industry": "Services",
        "age": 1,
        "employees": 3,
        "annual_revenue": 100000.0,
        "monthly_cash_flow": -10000.0,
        "monthly_expenses": 25000.0,
        "existing_debt": 80000.0,
        "digital_transactions": 20,
        "utility_payment_score": 40.0,
        "invoice_payment_score": 45.0,
        "previous_defaults": 2
    }
    res = prediction_service.predict_risk(sample)
    assert res["risk_level"] == "HIGH"
    assert res["default_probability"] > 50.0
    assert any("default" in f.lower() or "debt" in f.lower() or "cash flow" in f.lower() for f in res["risk_factors"])
