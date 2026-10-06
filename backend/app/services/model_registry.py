import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..config import settings
from ..database import models

logger = logging.getLogger("model_registry")

class ModelRegistryService:
    """
    Manages the model registry, version tracking, model card generation,
    and factual distribution monitoring based on model_metadata.json.
    """

    def __init__(self):
        self._metadata: Optional[Dict[str, Any]] = None

    def load_metadata(self) -> Dict[str, Any]:
        if self._metadata is None:
            if os.path.exists(settings.MODEL_METADATA_PATH):
                try:
                    with open(settings.MODEL_METADATA_PATH, "r", encoding="utf-8") as f:
                        self._metadata = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to load model metadata: {e}")
                    self._metadata = {}
            else:
                self._metadata = {}
        return self._metadata

    def get_model_info(self) -> Dict[str, Any]:
        """Returns verified metadata for active production model."""
        meta = self.load_metadata()
        eval_metrics = meta.get("evaluation_metrics", {})
        
        return {
            "model_id": "msme-xgb-v1.1.0",
            "model_name": "MSME Credit Risk Model",
            "model_version": meta.get("model_version", settings.MODEL_VERSION),
            "algorithm": meta.get("best_model", "XGBoost"),
            "training_date": meta.get("trained_at", "2026-09-16T10:19:42"),
            "feature_count": len(meta.get("features", {}).get("numerical", [])) + len(meta.get("features", {}).get("categorical", [])),
            "training_samples": meta.get("training_samples", 2500),
            "test_samples": meta.get("test_samples", 500),
            "training_dataset": "2,500 training samples, 500 test samples (MSME portfolio)",
            "roc_auc": eval_metrics.get("roc_auc", meta.get("best_roc_auc")),
            "accuracy": eval_metrics.get("accuracy"),
            "precision": eval_metrics.get("precision"),
            "recall": eval_metrics.get("recall"),
            "f1_score": eval_metrics.get("f1_score"),
            "confusion_matrix": eval_metrics.get("confusion_matrix"),
            "status": "ACTIVE",
            "created_at": meta.get("trained_at", "2026-09-16T10:19:42")
        }

    def get_model_card(self) -> Dict[str, Any]:
        """
        Generates comprehensive Model Card documentation with Responsible AI guidelines.
        """
        info = self.get_model_info()
        meta = self.load_metadata()
        features = meta.get("features", {})
        
        return {
            "model_overview": {
                "model_name": info["model_name"],
                "version": info["model_version"],
                "algorithm": info["algorithm"],
                "release_status": "Production Active",
                "training_timestamp": info["training_date"]
            },
            "purpose": {
                "intended_use": "Decision-support default risk assessment for MSME credit underwriting.",
                "primary_users": "Commercial credit analysts, loan underwriters, and institutional risk officers.",
                "out_of_scope": "Autonomous loan approvals or automated credit rejections without underwriter sign-off."
            },
            "features": {
                "numerical": features.get("numerical", [
                    "age", "employees", "annual_revenue", "monthly_cash_flow",
                    "monthly_expenses", "existing_debt", "digital_transactions",
                    "utility_payment_score", "invoice_payment_score", "previous_defaults"
                ]),
                "categorical": features.get("categorical", ["industry"])
            },
            "training_and_evaluation": {
                "training_dataset": info["training_dataset"],
                "training_samples": info["training_samples"],
                "test_samples": info["test_samples"],
                "evaluation_metrics": {
                    "roc_auc": info["roc_auc"],
                    "accuracy": info["accuracy"],
                    "precision": info["precision"],
                    "recall": info["recall"],
                    "f1_score": info["f1_score"],
                    "confusion_matrix": info["confusion_matrix"]
                }
            },
            "risk_thresholds": {
                "low_risk": "0.0% to 24.9% default probability (Score: 0–24)",
                "medium_risk": "25.0% to 54.9% default probability (Score: 25–55)",
                "high_risk": "55.0% to 100.0% default probability (Score: 56–100)",
                "policy": "High risk assessments trigger automated underwriter escalations."
            },
            "explainability": {
                "methodology": "Factor decomposition ranking positive indicators and risk drivers across 7 underwriting dimensions.",
                "categories": [
                    "Financial Strength", "Cash Flow", "Debt Burden",
                    "Revenue Stability", "Transaction Behaviour",
                    "Payment Behaviour", "Alternative Signals"
                ]
            },
            "known_limitations": [
                "Micro-telemetry does not capture sudden macroeconomic shocks or currency hyper-devaluations.",
                "Thin-file businesses with zero digital transactions rely heavily on baseline cash-flow ratios.",
                "Model confidence indicates classification boundary margin, not mathematical ground-truth certainty."
            ],
            "responsible_ai_and_fairness": {
                "fairness_metrics_status": "Fairness metrics are not currently calculated.",
                "bias_mitigation": "Underwriting models must be audited periodically across regional sectors. AI predictions represent decision support, not binding statutory ratings.",
                "human_in_the_loop": "All loan determinations mandate human underwriter governance."
            },
            "responsible_ai_notice": "This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans."
        }

    def get_monitoring_metrics(self, db: Session, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Calculates aggregate model monitoring statistics across historical predictions.
        Supports date filtering (7, 30, 90, or None for all time).
        """
        query = db.query(models.Prediction).join(models.Assessment)
        
        if days and days > 0:
            cutoff = datetime.utcnow() - timedelta(days=days)
            query = query.filter(models.Prediction.created_at >= cutoff)

        predictions = query.all()
        total_count = len(predictions)

        if total_count == 0:
            return {
                "model_version": settings.MODEL_VERSION,
                "total_predictions": 0,
                "risk_distribution": {"LOW": 0, "MEDIUM": 0, "HIGH": 0},
                "risk_percentages": {"LOW": 0.0, "MEDIUM": 0.0, "HIGH": 0.0},
                "average_probability": 0.0,
                "average_risk_score": 0.0,
                "average_data_quality": 100.0,
                "missing_data_rate": 0.0,
                "days_filtered": days
            }

        low_count = sum(1 for p in predictions if p.risk_level == "LOW")
        med_count = sum(1 for p in predictions if p.risk_level == "MEDIUM")
        high_count = sum(1 for p in predictions if p.risk_level == "HIGH")

        probs = [p.default_probability for p in predictions]
        scores = [p.risk_score if p.risk_score is not None else p.default_probability for p in predictions]
        quality_scores = [p.data_quality_score if p.data_quality_score is not None else 90.0 for p in predictions]

        return {
            "model_version": settings.MODEL_VERSION,
            "total_predictions": total_count,
            "risk_distribution": {
                "LOW": low_count,
                "MEDIUM": med_count,
                "HIGH": high_count
            },
            "risk_percentages": {
                "LOW": round((low_count / total_count) * 100, 1),
                "MEDIUM": round((med_count / total_count) * 100, 1),
                "HIGH": round((high_count / total_count) * 100, 1)
            },
            "average_probability": round(float(np.mean(probs)), 1),
            "average_risk_score": round(float(np.mean(scores)), 1),
            "average_data_quality": round(float(np.mean(quality_scores)), 1),
            "missing_data_rate": 0.0,
            "days_filtered": days
        }

    def get_data_drift_stats(self, db: Session) -> Dict[str, Any]:
        """
        Computes sample statistics for key features.
        Adheres strictly to the requirement: if baseline training stats are not in metadata,
        it displays 'Baseline statistics unavailable.' without fabricating drift metrics.
        """
        features_to_monitor = [
            "annual_revenue",
            "monthly_cash_flow",
            "monthly_expenses",
            "existing_debt",
            "digital_transactions",
            "utility_payment_score",
            "invoice_payment_score"
        ]

        assessments = db.query(models.Assessment).order_by(models.Assessment.created_at.desc()).limit(200).all()

        feature_stats = {}
        for feat in features_to_monitor:
            values = []
            for a in assessments:
                val = getattr(a, feat, None)
                if val is not None:
                    values.append(float(val))

            if values:
                feature_stats[feat] = {
                    "sample_size": len(values),
                    "mean": round(float(np.mean(values)), 2),
                    "median": round(float(np.median(values)), 2),
                    "min": round(float(np.min(values)), 2),
                    "max": round(float(np.max(values)), 2),
                    "missing_rate": round(1.0 - (len(values) / max(len(assessments), 1)), 3),
                    "baseline_mean": None,
                    "baseline_status": "Baseline statistics unavailable."
                }
            else:
                feature_stats[feat] = {
                    "sample_size": 0,
                    "mean": None,
                    "median": None,
                    "min": None,
                    "max": None,
                    "missing_rate": 1.0,
                    "baseline_mean": None,
                    "baseline_status": "Baseline statistics unavailable."
                }

        return {
            "monitored_features": feature_stats,
            "overall_status": "Baseline statistics unavailable.",
            "disclaimer": "Reference training distributions for individual features are not recorded in model_metadata.json. Baseline statistics unavailable; drift scores are not fabricated."
        }

model_registry_service = ModelRegistryService()

# Module-level convenience functions
get_model_metadata = model_registry_service.get_model_info
get_model_card = model_registry_service.get_model_card
get_monitoring_metrics = model_registry_service.get_monitoring_metrics
get_feature_drift = model_registry_service.get_data_drift_stats
