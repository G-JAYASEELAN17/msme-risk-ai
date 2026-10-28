import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from ..config import settings
from ..database import models
from ..schemas.decision_intelligence import FeatureDriftItem, DriftSnapshotResponse

logger = logging.getLogger("drift_service")

# Approved reference dataset location
def _resolve_reference_csv_path() -> str:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "processed", "msme_loans_clean.csv"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "processed", "msme_loans_clean.csv"),
        os.path.abspath("data/processed/msme_loans_clean.csv"),
        os.path.join(os.getcwd(), "data", "processed", "msme_loans_clean.csv")
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0]

REFERENCE_CSV_PATH = _resolve_reference_csv_path()

NUMERICAL_FEATURES = [
    "age",
    "employees",
    "annual_revenue",
    "monthly_cash_flow",
    "monthly_expenses",
    "existing_debt",
    "digital_transactions",
    "utility_payment_score",
    "invoice_payment_score",
    "previous_defaults"
]

CATEGORICAL_FEATURES = ["industry"]


class DriftService:
    """
    Computes genuine Population Stability Index (PSI) and categorical distribution shifts
    against the actual training/validation baseline dataset (msme_loans_clean.csv).
    Saves reproducible drift snapshots and raises persistent, deduplicated governance alerts.
    """

    def __init__(self, reference_path: str = REFERENCE_CSV_PATH):
        self.reference_path = reference_path
        self._reference_df: Optional[pd.DataFrame] = None
        self._reference_bins: Dict[str, np.ndarray] = {}
        self._reference_cat_dist: Dict[str, Dict[str, float]] = {}

    def load_reference_data(self) -> Optional[pd.DataFrame]:
        """Loads and caches the approved baseline training dataset."""
        if self._reference_df is not None:
            return self._reference_df

        if not os.path.exists(self.reference_path):
            logger.warning(f"Drift reference file not found at {self.reference_path}")
            return None

        try:
            df = pd.read_csv(self.reference_path)
            self._reference_df = df
            self._precompute_reference_distributions(df)
            logger.info(f"Loaded reference dataset with {len(df)} records for drift monitoring.")
            return self._reference_df
        except Exception as e:
            logger.error(f"Failed to read reference dataset from {self.reference_path}: {e}")
            return None

    def _precompute_reference_distributions(self, df: pd.DataFrame):
        """Precomputes decile bin edges and categorical proportions on reference data."""
        for feat in NUMERICAL_FEATURES:
            if feat in df.columns:
                series = df[feat].dropna()
                if len(series) > 0:
                    # 10 deciles (quantiles 0.1 to 0.9)
                    quantiles = np.quantile(series, np.linspace(0.1, 0.9, 9))
                    # Ensure bin edges are strictly monotonically increasing
                    bin_edges = np.unique(np.concatenate(([-np.inf], quantiles, [np.inf])))
                    self._reference_bins[feat] = bin_edges

        for cat_feat in CATEGORICAL_FEATURES:
            if cat_feat in df.columns:
                counts = df[cat_feat].value_counts(normalize=True).to_dict()
                self._reference_cat_dist[cat_feat] = counts

    def calculate_numerical_psi(
        self,
        feat_name: str,
        current_values: List[float],
        ref_df: pd.DataFrame
    ) -> Tuple[Optional[float], Optional[float], Optional[float], str]:
        """
        Calculates Population Stability Index (PSI) for a continuous/numerical feature.
        Formula: sum((Actual% - Expected%) * ln(Actual% / Expected%))
        """
        if feat_name not in self._reference_bins or len(current_values) < 5:
            return None, None, None, "INSUFFICIENT_DATA"

        bin_edges = self._reference_bins[feat_name]
        ref_series = ref_df[feat_name].dropna()
        ref_mean = round(float(ref_series.mean()), 2)
        curr_mean = round(float(np.mean(current_values)), 2)

        # Expected counts in reference data
        ref_counts, _ = np.histogram(ref_series, bins=bin_edges)
        ref_total = len(ref_series)
        expected_pct = (ref_counts + 0.0001) / (ref_total + 0.0001 * len(ref_counts))

        # Actual counts in current sample
        curr_counts, _ = np.histogram(current_values, bins=bin_edges)
        curr_total = len(current_values)
        actual_pct = (curr_counts + 0.0001) / (curr_total + 0.0001 * len(curr_counts))

        # Calculate PSI
        psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
        psi_score = round(float(np.clip(psi, 0.0, 10.0)), 4)

        # Shift percentage of the mean
        shift_pct = None
        if ref_mean != 0:
            shift_pct = round(float(abs((curr_mean - ref_mean) / ref_mean) * 100), 1)

        # Interpret status
        if psi_score < 0.10:
            status = "NO_DRIFT"
        elif psi_score < 0.25:
            status = "MODERATE_DRIFT"
        else:
            status = "SIGNIFICANT_DRIFT"

        return psi_score, shift_pct, curr_mean, status

    def calculate_categorical_psi(
        self,
        feat_name: str,
        current_values: List[str],
        ref_df: pd.DataFrame
    ) -> Tuple[Optional[float], Optional[float], str]:
        """
        Calculates distribution shift and categorical PSI for nominal/categorical features.
        """
        if feat_name not in self._reference_cat_dist or len(current_values) < 5:
            return None, None, "INSUFFICIENT_DATA"

        ref_dist = self._reference_cat_dist[feat_name]
        curr_counts = pd.Series(current_values).value_counts().to_dict()
        curr_total = len(current_values)

        all_categories = set(ref_dist.keys()).union(set(curr_counts.keys()))
        psi_sum = 0.0
        total_abs_diff = 0.0

        for cat in all_categories:
            exp_pct = ref_dist.get(cat, 0.0001)
            act_count = curr_counts.get(cat, 0)
            act_pct = (act_count + 0.0001) / (curr_total + 0.0001 * len(all_categories))

            psi_sum += (act_pct - exp_pct) * np.log(act_pct / exp_pct)
            total_abs_diff += abs(act_pct - exp_pct)

        psi_score = round(float(np.clip(psi_sum, 0.0, 10.0)), 4)
        dist_shift_pct = round(float((total_abs_diff / 2.0) * 100), 1)

        if psi_score < 0.10:
            status = "NO_DRIFT"
        elif psi_score < 0.25:
            status = "MODERATE_DRIFT"
        else:
            status = "SIGNIFICANT_DRIFT"

        return psi_score, dist_shift_pct, status

    def compute_drift_snapshot(
        self,
        db: Session,
        window_days: int = 90,
        save_snapshot: bool = True
    ) -> DriftSnapshotResponse:
        """
        Computes drift across current assessments within the specified window against the baseline.
        Records persistent snapshot and issues governance alerts if drift thresholds are violated.
        """
        ref_df = self.load_reference_data()
        now = datetime.utcnow()

        if ref_df is None:
            # Baseline data unavailable
            empty_items: Dict[str, FeatureDriftItem] = {}
            for feat in NUMERICAL_FEATURES:
                empty_items[feat] = FeatureDriftItem(
                    feature_name=feat,
                    feature_type="numerical",
                    psi_score=None,
                    distribution_shift_pct=None,
                    baseline_mean=None,
                    current_mean=None,
                    status="BASELINE_UNAVAILABLE"
                )
            for feat in CATEGORICAL_FEATURES:
                empty_items[feat] = FeatureDriftItem(
                    feature_name=feat,
                    feature_type="categorical",
                    psi_score=None,
                    distribution_shift_pct=None,
                    baseline_mean=None,
                    current_mean=None,
                    status="BASELINE_UNAVAILABLE"
                )

            return DriftSnapshotResponse(
                id=0,
                model_version=settings.MODEL_VERSION,
                reference_dataset="Unavailable (msme_loans_clean.csv missing)",
                observation_count=0,
                evaluation_window_days=window_days,
                overall_drift_status="BASELINE_UNAVAILABLE",
                mean_psi=None,
                feature_drift_metrics=empty_items,
                calculated_at=now
            )

        # Retrieve current assessments within window
        cutoff = now - timedelta(days=window_days)
        assessments = db.query(models.Assessment).filter(
            models.Assessment.created_at >= cutoff
        ).order_by(models.Assessment.created_at.desc()).all()

        obs_count = len(assessments)
        feature_metrics: Dict[str, FeatureDriftItem] = {}
        psi_scores = []
        significant_drift_features = []
        moderate_drift_features = []

        # Numerical feature evaluations
        for feat in NUMERICAL_FEATURES:
            vals = [float(getattr(a, feat)) for a in assessments if getattr(a, feat, None) is not None]
            base_mean = round(float(ref_df[feat].mean()), 2) if feat in ref_df.columns else None

            if obs_count < 5 or len(vals) < 5:
                feature_metrics[feat] = FeatureDriftItem(
                    feature_name=feat,
                    feature_type="numerical",
                    psi_score=None,
                    distribution_shift_pct=None,
                    baseline_mean=base_mean,
                    current_mean=round(float(np.mean(vals)), 2) if vals else None,
                    status="INSUFFICIENT_DATA"
                )
            else:
                psi, shift_pct, curr_m, status = self.calculate_numerical_psi(feat, vals, ref_df)
                feature_metrics[feat] = FeatureDriftItem(
                    feature_name=feat,
                    feature_type="numerical",
                    psi_score=psi,
                    distribution_shift_pct=shift_pct,
                    baseline_mean=base_mean,
                    current_mean=curr_m,
                    status=status
                )
                if psi is not None:
                    psi_scores.append(psi)
                    if status == "SIGNIFICANT_DRIFT":
                        significant_drift_features.append((feat, psi))
                    elif status == "MODERATE_DRIFT":
                        moderate_drift_features.append((feat, psi))

        # Categorical feature evaluation
        for feat in CATEGORICAL_FEATURES:
            cat_vals = [str(getattr(a, feat)) for a in assessments if getattr(a, feat, None) is not None]
            if obs_count < 5 or len(cat_vals) < 5:
                feature_metrics[feat] = FeatureDriftItem(
                    feature_name=feat,
                    feature_type="categorical",
                    psi_score=None,
                    distribution_shift_pct=None,
                    baseline_mean=None,
                    current_mean=None,
                    status="INSUFFICIENT_DATA"
                )
            else:
                psi, shift_pct, status = self.calculate_categorical_psi(feat, cat_vals, ref_df)
                feature_metrics[feat] = FeatureDriftItem(
                    feature_name=feat,
                    feature_type="categorical",
                    psi_score=psi,
                    distribution_shift_pct=shift_pct,
                    baseline_mean=None,
                    current_mean=None,
                    status=status
                )
                if psi is not None:
                    psi_scores.append(psi)
                    if status == "SIGNIFICANT_DRIFT":
                        significant_drift_features.append((feat, psi))
                    elif status == "MODERATE_DRIFT":
                        moderate_drift_features.append((feat, psi))

        # Overall Status
        if obs_count < 5:
            overall_status = "INSUFFICIENT_DATA"
            mean_psi = None
        elif len(significant_drift_features) > 0:
            overall_status = "SIGNIFICANT_DRIFT"
            mean_psi = round(float(np.mean(psi_scores)), 4) if psi_scores else None
        elif len(moderate_drift_features) > 0:
            overall_status = "MODERATE_DRIFT"
            mean_psi = round(float(np.mean(psi_scores)), 4) if psi_scores else None
        else:
            overall_status = "STABLE"
            mean_psi = round(float(np.mean(psi_scores)), 4) if psi_scores else None

        # Check and issue governance alerts
        if obs_count >= 5:
            self._handle_drift_alerts(db, significant_drift_features, moderate_drift_features)

        # Snapshot persistence
        snapshot_id = 0
        if save_snapshot:
            try:
                metrics_dict = {k: v.model_dump() for k, v in feature_metrics.items()}
                db_snap = models.ModelDriftSnapshot(
                    model_version=settings.MODEL_VERSION,
                    reference_dataset="msme_loans_clean.csv (N=2,501)",
                    observation_count=obs_count,
                    evaluation_window_days=window_days,
                    overall_drift_status=overall_status,
                    mean_psi=mean_psi,
                    feature_drift_metrics=metrics_dict
                )
                db.add(db_snap)
                db.commit()
                db.refresh(db_snap)
                snapshot_id = db_snap.id
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to persist ModelDriftSnapshot: {e}")

        return DriftSnapshotResponse(
            id=snapshot_id,
            model_version=settings.MODEL_VERSION,
            reference_dataset="msme_loans_clean.csv (N=2,501)",
            observation_count=obs_count,
            evaluation_window_days=window_days,
            overall_drift_status=overall_status,
            mean_psi=mean_psi,
            feature_drift_metrics=feature_metrics,
            calculated_at=now
        )

    def _handle_drift_alerts(
        self,
        db: Session,
        significant_feats: List[Tuple[str, float]],
        moderate_feats: List[Tuple[str, float]]
    ):
        """Creates deduplicated governance alerts for detected feature drift."""
        try:
            for feat, psi in significant_feats:
                existing = db.query(models.GovernanceAlert).filter(
                    models.GovernanceAlert.alert_type == "FEATURE_DRIFT",
                    models.GovernanceAlert.metric_name == feat,
                    models.GovernanceAlert.status.in_(["OPEN", "ACKNOWLEDGED"])
                ).first()

                if not existing:
                    alert = models.GovernanceAlert(
                        alert_type="FEATURE_DRIFT",
                        severity="CRITICAL",
                        title=f"Significant Drift in {feat}",
                        description=(
                            f"Population Stability Index (PSI) for {feat} reached {psi:.3f}, "
                            f"exceeding the critical governance threshold of 0.250."
                        ),
                        metric_name=feat,
                        observed_value=psi,
                        threshold_value=0.250,
                        model_version=settings.MODEL_VERSION,
                        status="OPEN"
                    )
                    db.add(alert)

            for feat, psi in moderate_feats:
                existing = db.query(models.GovernanceAlert).filter(
                    models.GovernanceAlert.alert_type == "FEATURE_DRIFT",
                    models.GovernanceAlert.metric_name == feat,
                    models.GovernanceAlert.status.in_(["OPEN", "ACKNOWLEDGED"])
                ).first()

                if not existing:
                    alert = models.GovernanceAlert(
                        alert_type="FEATURE_DRIFT",
                        severity="WARNING",
                        title=f"Moderate Drift in {feat}",
                        description=(
                            f"Population Stability Index (PSI) for {feat} reached {psi:.3f}, "
                            f"exceeding the monitoring threshold of 0.100."
                        ),
                        metric_name=feat,
                        observed_value=psi,
                        threshold_value=0.100,
                        model_version=settings.MODEL_VERSION,
                        status="OPEN"
                    )
                    db.add(alert)

            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to record drift governance alerts: {e}")


drift_service = DriftService()
