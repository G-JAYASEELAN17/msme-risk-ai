from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field


class ShapContributionItem(BaseModel):
    feature_name: str
    display_name: str
    feature_value: Any
    unit: Optional[str] = None
    contribution: float  # signed log-odds contribution
    abs_contribution: float
    direction: str  # INCREASES_RISK | DECREASES_RISK | NEUTRAL
    rank: int
    business_definition: str
    plain_text_explanation: str
    is_safe_for_role: bool = True


class WaterfallStepItem(BaseModel):
    step_index: int
    label: str
    delta: float
    cumulative: float
    step_type: str  # baseline | factor | output


class LocalExplanationResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    assessment_id: int
    model_name: str = "MSME Credit Risk Model"
    model_version: str
    explainer_type: str = "TreeSHAP"
    explanation_method: str = "TreeSHAP (Exact Tree Ensemble Margin Attributions)"
    output_space: str = "log-odds (margin)"
    baseline_value: float
    raw_margin: float
    predicted_probability: float  # model-estimated probability (0-100%)
    risk_level: str  # LOW | MEDIUM | HIGH
    risk_band_label: str
    risk_score: Optional[float] = None
    predicted_outcome: Optional[str] = None
    data_completeness_pct: Optional[float] = 100.0
    manual_review_recommended: bool = False
    explanation_status: str  # AVAILABLE | PARTIAL | UNAVAILABLE | FAILED
    additivity_reconciled: bool
    reconciliation_difference: float
    waterfall_steps: List[WaterfallStepItem]
    contributions: List[ShapContributionItem]
    positive_drivers: List[ShapContributionItem]
    negative_drivers: List[ShapContributionItem]
    warnings: List[str] = []
    created_at: datetime


class GlobalFeatureImportanceItem(BaseModel):
    feature_name: str
    display_name: str
    mean_abs_shap: float
    rank: int
    xgboost_gain: Optional[float] = None
    xgboost_weight: Optional[float] = None
    business_definition: str
    unit: Optional[str] = None


class GlobalExplanationResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_version: str
    dataset_fingerprint: str
    sample_count: int
    evaluation_data_provenance: str
    top_features: List[GlobalFeatureImportanceItem]
    all_features: List[GlobalFeatureImportanceItem]
    shap_aggregation_method: str = "mean_absolute"
    calculated_at: datetime
    is_representative: bool
    warnings: List[str] = []


class CounterfactualCandidateItem(BaseModel):
    feature_name: str
    display_name: str
    original_value: float
    proposed_value: float
    change_magnitude: float
    change_percentage: float
    unit: str
    is_actionable: bool


class CounterfactualScenarioItem(BaseModel):
    scenario_id: str
    target_risk_level: str
    counterfactual_probability: float
    counterfactual_risk_level: str
    probability_reduction: float
    proposed_changes: List[CounterfactualCandidateItem]
    feasibility_score: float  # 0 to 100
    guidance_summary: str


class CounterfactualRequest(BaseModel):
    target_risk_level: Optional[str] = None  # LOW or MEDIUM


class CounterfactualResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    assessment_id: int
    model_version: str
    original_probability: float
    original_risk_level: str
    status: str  # FOUND | NO_VALID_CANDIDATE | UNSUPPORTED
    scenarios: List[CounterfactualScenarioItem]
    search_constraints: Dict[str, Any]
    immutable_features: List[str]
    actionable_features: List[str]
    disclaimers: List[str] = []


class WhatIfExplanationRequest(BaseModel):
    hypothetical_inputs: Dict[str, Any]


class WhatIfExplanationResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    assessment_id: int
    model_version: str
    original_probability: float
    original_risk_level: str
    hypothetical_probability: float
    hypothetical_risk_level: str
    probability_delta: float
    waterfall_steps: List[WaterfallStepItem]
    contributions: List[ShapContributionItem]
    changed_features: List[Dict[str, Any]]
    is_simulation: bool = True
    disclaimers: List[str] = []


class StabilityEvaluationResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    assessment_id: int
    model_version: str
    perturbation_method: str
    scenarios_evaluated: int
    risk_band_retention_rate: float  # Percentage (0-100%)
    probability_variance: float
    top_features_stability_score: float  # 0 - 100%
    stability_rating: str  # HIGH | MODERATE | SENSITIVE
    limitations: List[str] = []


class ModelMetadataResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_version: str
    model_type: str
    explainer_type: str
    evaluation_metrics: Dict[str, Any]
    features: Dict[str, List[str]]
    training_samples: int
    test_samples: int
    trained_at: Optional[str] = None
