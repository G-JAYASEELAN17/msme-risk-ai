import os
import json
import joblib
import numpy as np
import logging
from typing import Dict, Any, List, Optional

from ..config import settings
from .preprocessing import preprocessing_service
from .risk_intelligence_service import risk_intelligence_service
from .model_registry import model_registry_service

logger = logging.getLogger(__name__)

class PredictionService:
    def __init__(self):
        self.model = None
        self.metadata = None

    def load_model(self):
        """Loads the trained ML model if not already loaded."""
        if self.model is None:
            if not os.path.exists(settings.MODEL_PATH):
                logger.warning(f"Model file not found at {settings.MODEL_PATH}")
                return None
            self.model = joblib.load(settings.MODEL_PATH)
        return self.model

    def load_metadata(self):
        """Loads model evaluation metadata if available."""
        if self.metadata is None and os.path.exists(settings.MODEL_METADATA_PATH):
            try:
                with open(settings.MODEL_METADATA_PATH, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load model metadata: {e}")
        return self.metadata

    def predict_risk(self, data_dict: dict) -> dict:
        """
        Executes prediction on input features, calculating:
        1. Default Probability (0-100%)
        2. Risk Level (LOW / MEDIUM / HIGH)
        3. Risk Score (0-100)
        4. Model Confidence Indicator
        5. Data Quality Score (0-100)
        6. Categorized Explainable Factors across 7 underwriting dimensions
        7. Top Positive and Negative factors
        8. Deterministic Analyst Underwriting Summary
        """
        model = self.load_model()
        
        # 1. Calculate Data Quality Score
        data_quality_score, data_quality_tier, quality_notes = (
            risk_intelligence_service.calculate_data_quality_score(data_dict)
        )

        # 2. Model Prediction
        if model is None:
            # Fallback heuristic calculation if model artifact is absent
            debt = float(data_dict.get("existing_debt", 0))
            rev = float(data_dict.get("annual_revenue", 1))
            cf = float(data_dict.get("monthly_cash_flow", 0))
            exp = float(data_dict.get("monthly_expenses", 1))
            defaults = float(data_dict.get("previous_defaults", 0))
            util = float(data_dict.get("utility_payment_score", 70))
            inv = float(data_dict.get("invoice_payment_score", 70))
            
            heuristic_raw = (
                (debt / max(rev, 1) * 3.0) 
                - (cf / max(exp, 1) * 1.5) 
                + (defaults * 2.5) 
                - (util / 100.0 * 2.0) 
                - (inv / 100.0 * 1.5)
            )
            prob = 1.0 / (1.0 + np.exp(-heuristic_raw))
            prob = float(np.clip(prob, 0.04, 0.96))
        else:
            X_processed = preprocessing_service.preprocess_single(data_dict)
            prob = float(model.predict_proba(X_processed)[0, 1])
        
        prob_pct = float(np.round(prob * 100, 1))

        # 3. Risk classification thresholds
        if prob < 0.25:
            risk_level = "LOW"
        elif prob < 0.55:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"
            
        # 4. Normalized Risk Score (0–100)
        risk_score = risk_intelligence_service.calculate_risk_score(prob_pct)

        # 5. Model confidence rating (Distance from 0.5 decision boundary)
        certainty = 0.5 + abs(prob - 0.5)
        confidence_pct = float(np.round(certainty * 100, 1))

        # 6. Factor Categorization across 7 dimensions
        factor_breakdown = risk_intelligence_service.categorize_factors(data_dict)

        # 7. Extract Top Factors, Positives, and Negatives
        top_factors = []
        positive_factors = []
        risk_factors = []

        debt = float(data_dict.get("existing_debt", 0))
        rev = float(data_dict.get("annual_revenue", 1))
        debt_to_rev = debt / max(rev, 1)
        cf = float(data_dict.get("monthly_cash_flow", 0))
        exp = float(data_dict.get("monthly_expenses", 1))
        cf_to_exp = cf / max(exp, 1)
        defaults = int(data_dict.get("previous_defaults", 0))
        util_score = float(data_dict.get("utility_payment_score", 0))
        inv_score = float(data_dict.get("invoice_payment_score", 0))
        age = int(data_dict.get("age", 0))
        txns = int(data_dict.get("digital_transactions", 0))

        # Debt leverage
        if debt_to_rev > 0.40:
            risk_factors.append(f"Elevated debt-to-revenue leverage ({debt_to_rev:.1%})")
            top_factors.append("High debt-to-revenue ratio")
        elif debt_to_rev < 0.15:
            positive_factors.append(f"Low debt leverage ({debt_to_rev:.1%} of revenue)")
            top_factors.append("Low debt leverage")

        # Cash flow buffer
        if cf <= 0:
            risk_factors.append(f"Negative monthly cash flow (₹{cf:,.0f})")
            top_factors.append("Negative cash flow buffer")
        elif cf_to_exp > 0.35:
            positive_factors.append(f"Strong cash flow buffer ({cf_to_exp:.1%} of expenses)")
            top_factors.append("Robust operating cash flow")
        elif cf_to_exp < 0.10:
            risk_factors.append(f"Tight cash flow coverage ({cf_to_exp:.1%} of expenses)")

        # Default history
        if defaults > 0:
            risk_factors.append(f"Past history of {defaults} loan default(s)")
            top_factors.append("Prior loan defaults recorded")
        else:
            positive_factors.append("Clean credit history with zero prior defaults")
            top_factors.append("Zero previous defaults")

        # Utility & Invoice payment
        if util_score >= 85:
            positive_factors.append(f"Consistent utility payment record ({util_score:.0f}/100)")
        elif util_score < 60:
            risk_factors.append(f"Inconsistent utility bill payment score ({util_score:.0f}/100)")

        if inv_score >= 85:
            positive_factors.append(f"High invoice fulfillment score ({inv_score:.0f}/100)")
        elif inv_score < 60:
            risk_factors.append(f"Weak supplier invoice fulfillment history ({inv_score:.0f}/100)")

        if util_score >= 80 and inv_score >= 80:
            top_factors.append("Strong alternative payment history")
        elif util_score < 60 or inv_score < 60:
            top_factors.append("Sub-optimal bill repayment score")

        # Business age
        if age >= 5:
            positive_factors.append(f"Established operational longevity ({age} years in market)")
            top_factors.append("Business maturity")
        elif age < 2:
            risk_factors.append(f"Early stage startup operational risk ({age} year(s))")
            top_factors.append("Early stage business age")

        # Transaction footprint
        if txns > 300:
            positive_factors.append(f"Active digital transaction velocity ({txns} txns/mo)")
        elif txns < 50:
            risk_factors.append(f"Low digital transaction footprint ({txns} txns/mo)")

        # Ensure non-empty fallbacks
        if not top_factors:
            top_factors = ["Balanced MSME financial indicators"]
        if not positive_factors:
            positive_factors = ["Standard operational profile"]
        if not risk_factors:
            risk_factors = ["No immediate critical default risks detected"]

        # 8. Deterministic Analyst Summary
        business_name = data_dict.get("name") or "MSME Enterprise"
        analyst_summary = risk_intelligence_service.generate_analyst_summary(
            business_name=business_name,
            risk_level=risk_level,
            probability=prob_pct,
            risk_score=risk_score,
            data_quality_score=data_quality_score,
            positive_factors=positive_factors,
            risk_factors=risk_factors
        )

        return {
            "default_probability": prob_pct,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "confidence": confidence_pct,
            "data_quality_score": data_quality_score,
            "data_quality_tier": data_quality_tier,
            "top_factors": top_factors[:3],
            "positive_factors": positive_factors[:4],
            "risk_factors": risk_factors[:4],
            "factor_breakdown": factor_breakdown,
            "analyst_summary": analyst_summary,
            "model_version": settings.MODEL_VERSION
        }

prediction_service = PredictionService()
